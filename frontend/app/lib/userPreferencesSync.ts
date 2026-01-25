// Utility function to update user preferences categories from wishlist + purchases
export async function updateUserPreferences(uid: string) {
  try {
    const response = await fetch(`/api/users/sync-preferences?uid=${uid}`, {
      method: 'POST',
    });

    if (!response.ok) {
      console.error('Failed to sync user preferences');
    }
  } catch (error) {
    console.error('Error syncing user preferences:', error);
  }
}
