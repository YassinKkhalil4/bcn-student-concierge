import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Storage for encrypted document bodies, separate from case metadata.
 *
 * Two drivers behind one interface:
 *   - local  — files under DATA_DIR; on the VPS, the `documents` Docker volume
 *              (the default deployment).
 *   - s3     — any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO), used
 *              when S3_BUCKET is set.
 *
 * Bodies are keyed `cases/<caseId>/documents/<documentId>`, so erasing a case is
 * a single prefix delete. Only the key and the wrapped DEK live in Postgres.
 *
 * Bodies are stored as raw ciphertext — never plaintext, never base64 — already
 * sealed by crypto.ts. Any provider encryption (SSE-KMS on S3, disk encryption
 * on the VPS) sits underneath ours; neither replaces the other.
 */

export interface BlobStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  exists(key: string): Promise<boolean>;
}

export class BlobNotFoundError extends Error {}

/** Object key layout. Prefixed by case so a purge is a single prefix delete. */
export function documentKey(caseId: string, documentId: string): string {
  return `cases/${caseId}/documents/${documentId}`;
}

export function casePrefix(caseId: string): string {
  return `cases/${caseId}/`;
}

// ─────────────────────────────────────────────────────────────────────────
// S3 / R2 driver
// ─────────────────────────────────────────────────────────────────────────

/**
 * Works against AWS S3, Cloudflare R2, MinIO, or any S3-compatible endpoint.
 *
 * R2 specifics: set S3_ENDPOINT to the R2 gateway and S3_REGION to "auto".
 * R2 ignores server-side-encryption headers (it encrypts everything at rest
 * unconditionally), so SSE is only sent when S3_SSE is explicitly configured —
 * sending it to R2 causes some SDK versions to error on the unknown header.
 */
class S3BlobStore implements BlobStore {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly sse: string | undefined;
  private readonly kmsKeyId: string | undefined;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is not set");
    this.bucket = bucket;
    this.sse = process.env.S3_SSE;
    this.kmsKeyId = process.env.S3_SSE_KMS_KEY_ID;

    this.client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      // Absent for AWS S3; required for R2 and MinIO.
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
      // R2 and MinIO need path-style addressing.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      // Falls back to the ambient credential chain (IAM role, SSO) when these
      // are unset — which is the preferred production setup.
      ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        // The body is already ciphertext; this records the ORIGINAL type for
        // staff tooling. It is never used to serve the object to a browser.
        ContentType: "application/octet-stream",
        Metadata: { "original-content-type": contentType },
        ...(this.sse ? { ServerSideEncryption: this.sse as "AES256" | "aws:kms" } : {}),
        ...(this.kmsKeyId ? { SSEKMSKeyId: this.kmsKeyId } : {}),
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!res.Body) throw new BlobNotFoundError(`Empty body for ${key}`);
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "NoSuchKey" || error.name === "NotFound")
      ) {
        throw new BlobNotFoundError(`Object ${key} not found`);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /**
   * Delete every object under a prefix. Used by the retention purge.
   *
   * Paginated: ListObjectsV2 returns at most 1000 keys, and DeleteObjects
   * accepts at most 1000 per call. A case will never have that many documents,
   * but a purge that silently stopped at 1000 would leave passport scans behind
   * while reporting success — so the loop is written correctly regardless.
   */
  async deletePrefix(prefix: string): Promise<number> {
    let deleted = 0;
    let continuationToken: string | undefined;

    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const keys = (listed.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k));

      if (keys.length > 0) {
        const result = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
          }),
        );
        // Report partial failure loudly: a purge that half-worked must not be
        // recorded as complete, or the tombstone would lie about deletion.
        if (result.Errors && result.Errors.length > 0) {
          throw new Error(
            `Failed to delete ${result.Errors.length} object(s) under ${prefix}: ` +
              result.Errors.map((e) => `${e.Key}: ${e.Message}`).join("; "),
          );
        }
        deleted += keys.length;
      }

      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Local filesystem driver (VPS volume, or development)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Writes raw ciphertext to files — NOT base64 inside JSON — laid out exactly
 * like the object-store keys. Files are 0600 in 0700 directories. The contents
 * are already envelope-encrypted, so a copied volume or backup decrypts nothing
 * without the master key.
 */
class LocalBlobStore implements BlobStore {
  private readonly root: string;

  constructor() {
    // Resolve to an absolute path. The containment check in resolve() compares
    // absolute paths, so a relative DATA_DIR (the documented "./.data") would
    // otherwise make every key look like an escape and reject every upload.
    this.root = path.resolve(
      process.env.DATA_DIR ?? path.join(process.cwd(), ".data"),
      "blobs",
    );
  }

  /** Keys are server-generated, but never let one escape the root regardless. */
  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new Error(`Blob key escapes storage root: ${key}`);
    }
    return target;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, body, { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      throw new BlobNotFoundError(`Object ${key} not found`);
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<number> {
    const dir = this.resolve(prefix);
    let count = 0;
    try {
      count = (await readdir(dir, { recursive: true, withFileTypes: true })).filter(
        (e) => e.isFile(),
      ).length;
    } catch {
      return 0;
    }
    await rm(dir, { recursive: true, force: true });
    return count;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await readFile(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────

let store: BlobStore | null = null;

/**
 * Select the driver: S3/R2 when a bucket is configured, otherwise local disk.
 *
 * On a VPS, local disk is legitimate — a Docker volume persists across restarts
 * and deploys. What is NOT acceptable is writing passports to an implicit path
 * inside the container, which would vanish with it and sit outside backups. So
 * in production the local driver requires DATA_DIR to be set explicitly to an
 * absolute path (the mounted volume); anything else is a hard startup error.
 */
export function blobStore(): BlobStore {
  if (store) return store;

  if (process.env.S3_BUCKET) {
    store = new S3BlobStore();
  } else {
    const dir = process.env.DATA_DIR;
    if (process.env.NODE_ENV === "production" && (!dir || !path.isAbsolute(dir))) {
      throw new Error(
        "Document storage is not configured. Set DATA_DIR to an absolute path on a " +
          "persistent volume (or S3_BUCKET for object storage) — see docs/DEPLOY.md.",
      );
    }
    store = new LocalBlobStore();
  }

  return store;
}

/** Test seam. */
export function __setBlobStore(next: BlobStore | null): void {
  store = next;
}
