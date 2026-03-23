const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

let cachedClient = null;

function getEnv(name) {
  return (process.env[name] || '').trim();
}

function hasS3Config() {
  return Boolean(getEnv('AWS_REGION') && getEnv('AWS_S3_BUCKET'));
}

function getS3Bucket() {
  return getEnv('AWS_S3_BUCKET');
}

function getS3Prefix() {
  const prefix = getEnv('AWS_S3_PREFIX');
  if (!prefix) return 'request-documents';
  return prefix.replace(/^\/+|\/+$/g, '');
}

function getS3Client() {
  if (!cachedClient) {
    const region = getEnv('AWS_REGION');
    if (!region) {
      throw new Error('Missing AWS_REGION environment variable');
    }
    cachedClient = new S3Client({ region });
  }
  return cachedClient;
}

function sanitizeFileName(fileName) {
  return String(fileName || 'document.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}

function buildRequestDocumentKey({ requestId, fileName }) {
  const safeName = sanitizeFileName(fileName);
  const prefix = getS3Prefix();
  return `${prefix}/${requestId}/${Date.now()}-${safeName}`;
}

async function uploadBufferToS3({ key, contentType, body }) {
  const bucket = getS3Bucket();
  if (!bucket) {
    throw new Error('Missing AWS_S3_BUCKET environment variable');
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream'
  });

  await getS3Client().send(command);
}

async function streamToBuffer(readableStream) {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function getBufferFromS3(key) {
  const bucket = getS3Bucket();
  if (!bucket) {
    throw new Error('Missing AWS_S3_BUCKET environment variable');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });

  const response = await getS3Client().send(command);
  return streamToBuffer(response.Body);
}

module.exports = {
  hasS3Config,
  buildRequestDocumentKey,
  uploadBufferToS3,
  getBufferFromS3
};
