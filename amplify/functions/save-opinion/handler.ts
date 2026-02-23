import type { AppSyncResolverEvent } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

type SaveOpinionArgs = {
  key: string;
  markdown: string;
};

type IdentityClaims = {
  [key: string]: string | string[] | undefined;
};

const s3 = new S3Client({});

const bucket = process.env.OPINIONS_BUCKET;

const normalizeKey = (value: string) => {
  let key = value.trim().replace(/^\//, '');
  if (!key) throw new Error('Missing opinion key');
  if (key.includes('..') || key.includes('\\')) {
    throw new Error('Invalid opinion key');
  }
  key = key.replace(/\.txt/gi, '');
  if (!/\.md$/i.test(key)) {
    key = `${key}.md`;
  }
  return key;
};

const ensureAdmin = (claims?: IdentityClaims) => {
  const groups = claims?.['cognito:groups'];
  if (Array.isArray(groups)) return groups.includes('Admin');
  if (typeof groups === 'string') return groups.split(',').includes('Admin');
  return false;
};

export const handler = async (
  event: AppSyncResolverEvent<SaveOpinionArgs>,
) => {
  if (!bucket) {
    throw new Error('OPINIONS_BUCKET not configured');
  }
  const claims =
    event.identity && 'claims' in event.identity
      ? (event.identity.claims as IdentityClaims | undefined)
      : undefined;
  if (!ensureAdmin(claims)) {
    throw new Error('Unauthorized');
  }

  const key = normalizeKey(event.arguments.key);
  const markdown = event.arguments.markdown ?? '';

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: markdown,
      ContentType: 'text/markdown; charset=utf-8',
      CacheControl: 'public, max-age=60, must-revalidate',
    }),
  );

  return key;
};
