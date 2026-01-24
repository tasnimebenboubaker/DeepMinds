/**
 * Constructs the full Azure blob storage URL from an image path stored in MongoDB
 * @param imagePath - The image path from MongoDB (e.g., 'synthetic_images/product_198.png')
 * @returns The full URL to access the blob in Azure
 */
export function getAzureBlobUrl(imagePath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_AZURE_STORAGE_BASE_URL;
  
  if (!baseUrl) {
    console.warn('NEXT_PUBLIC_AZURE_STORAGE_BASE_URL is not defined');
    return ''; // Return empty string if not configured
  }
  
  // Extract just the filename from the path
  // If path is 'synthetic_images/product_198.png', extract 'product_198.png'
  const filename = imagePath.includes('/') 
    ? imagePath.split('/').pop() || imagePath 
    : imagePath;
  
  // Ensure the base URL ends with a trailing slash
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  // Combine the base URL with just the filename
  const fullUrl = `${normalizedBaseUrl}${filename}`;
  
  console.log('Azure Blob URL:', fullUrl); // Debug log
  
  return fullUrl;
}

/**
 * Validates if a string is a valid blob name or URL
 * @param imagePath - The image path to validate
 * @returns true if it's a valid blob URL, false otherwise
 */
export function isValidBlobUrl(imagePath: string): boolean {
  return imagePath.startsWith('http://') || imagePath.startsWith('https://');
}
