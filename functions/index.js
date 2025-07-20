// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cloudinary = require("cloudinary").v2;

admin.initializeApp();

// Securely configure the Cloudinary SDK using environment variables
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} catch (error) {
  console.error(
      "CRITICAL ERROR: Could not configure Cloudinary. " +
      "Make sure you have set the environment variables.",
  );
}

exports.deleteMarketItem = functions.https.onCall(async (data, context) => {
  // 1. Check for authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to delete an item.",
    );
  }

  const {itemId, imageUrl} = data;
  const db = admin.firestore();

  // 2. Validate incoming data
  if (!itemId || !imageUrl) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing itemId or imageUrl.",
    );
  }

  try {
    const itemRef = db.collection("marketListings").doc(itemId);

    // Security Check: Ensure the person deleting the item
    // is the one who created it.
    const doc = await itemRef.get();
    if (!doc.exists || doc.data().sellerId !== context.auth.uid) {
      throw new functions.https.HttpsError(
          "permission-denied",
          "You are not authorized to delete this item.",
      );
    }

    // 3. Extract the Public ID from the Cloudinary URL more reliably.
    // This handles URLs with transformations and folders correctly.
    const publicIdWithFolder = "market-items/" +
        imageUrl.split("/").pop().split(".")[0];

    // 4. Use a Promise.all to run deletions in parallel for efficiency
    await Promise.all([
      // Delete from Firestore
      itemRef.delete(),
      // Delete from Cloudinary
      cloudinary.uploader.destroy(publicIdWithFolder),
    ]);

    return {success: true, message: "Item deleted successfully."};
  } catch (error) {
    console.error("Deletion failed:", error.message);
    // Avoid leaking detailed internal errors to the client
    throw new functions.https.HttpsError(
        "internal",
        "An error occurred while deleting the item.",
    );
  }
});
