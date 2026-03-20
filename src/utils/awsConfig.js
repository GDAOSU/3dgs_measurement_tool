/**
 * AWS S3 Configuration for Public Bucket Access
 *
 * This module provides configuration for accessing public S3 buckets.
 * The application constructs direct, unsigned URLs to S3 objects,
 * which requires the S3 bucket to be publicly readable and have a
 * permissive CORS policy.
 *
 * Environment Variables Required in `.env` file:
 * - VITE_AWS_REGION: The AWS region of your S3 bucket (e.g., "us-east-1").
 * - VITE_S3_BUCKET: The name of your public S3 bucket.
 */

export const AWS_REGION = import.meta.env.VITE_AWS_REGION;
export const DEFAULT_BUCKET = import.meta.env.VITE_S3_BUCKET;

/**
 * Get default S3 bucket name from environment variables.
 * @returns {string | undefined}
 */
export function getDefaultBucket() {
  return DEFAULT_BUCKET;
}

/**
 * Get AWS region from environment variables.
 * @returns {string | undefined}
 */
export function getAwsRegion() {
  return AWS_REGION;
}

/**
 * Validates that the required AWS environment variables are set.
 * @returns {boolean} True if configuration is valid, false otherwise.
 */
export function validateAwsConfig() {
  return !!(AWS_REGION && DEFAULT_BUCKET);
}
