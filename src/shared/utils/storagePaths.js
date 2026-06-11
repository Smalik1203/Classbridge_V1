// Helpers for mapping Supabase Storage public/signed URLs back to the
// bucket + object path needed by `supabase.storage.from(bucket).remove([...])`.
//
// Why this exists: several tables store the *full* public URL of an uploaded
// file (e.g. learning_resources.content_url) rather than the raw object path.
// To delete the underlying file we must recover bucket + path from that URL.
// External links (YouTube, arbitrary URLs the user typed) are NOT storage
// objects and must be left alone — these helpers return null for those.

/**
 * Parse a Supabase Storage URL into { bucket, path }.
 *
 * Handles both public and signed URL shapes:
 *   .../storage/v1/object/public/<bucket>/<path...>
 *   .../storage/v1/object/sign/<bucket>/<path...>?token=...
 *   .../storage/v1/object/<bucket>/<path...>           (authenticated)
 *
 * Returns null if the string isn't a Supabase Storage object URL (e.g. a
 * YouTube link or a bare path), so callers can safely skip the storage delete.
 *
 * @param {string} url
 * @returns {{ bucket: string, path: string } | null}
 */
export const parseStorageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;

  const marker = '/storage/v1/object/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  // Strip query string (signed URLs carry ?token=...) and the marker prefix.
  let rest = url.slice(idx + marker.length).split('?')[0];

  // Drop the access qualifier segment if present.
  for (const prefix of ['public/', 'sign/', 'authenticated/']) {
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length);
      break;
    }
  }

  const slash = rest.indexOf('/');
  if (slash === -1) return null;

  const bucket = rest.slice(0, slash);
  const path = decodeURIComponent(rest.slice(slash + 1));
  if (!bucket || !path) return null;

  return { bucket, path };
};

/**
 * If `url` is a storage object in `expectedBucket`, return its object path;
 * otherwise return null (external link, wrong bucket, or unparsable).
 *
 * @param {string} url
 * @param {string} expectedBucket
 * @returns {string | null}
 */
export const storagePathForBucket = (url, expectedBucket) => {
  const parsed = parseStorageUrl(url);
  if (!parsed) return null;
  if (parsed.bucket !== expectedBucket) return null;
  return parsed.path;
};
