const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

/**
 * Update the hole scores for a specific player in a given bracket collection (e.g., I_Cuartos, I_Semifinales).
 * @param {string} playerId - The player ID whose scores are being updated.
 * @param {Object} scoreCard - The scorecard object from the API response.
 * @param {string} tournamentId - The tournament ID.
 * @param {string} year - The year of the tournament.
 * @param {string} collectionName - The collection name (e.g., "I_Cuartos", "I_Semifinales").
 */
const updatePlayerHoleScores = async (playerId, scoreCard, tournamentId, year, collectionName) => {
  try {
    const bracketRef = db.collection("I_Torneos").doc(year)
      .collection("Tournaments").doc(tournamentId)
      .collection(collectionName);

    const playerDocRef = bracketRef.doc(playerId);

    let holeUpdates = {};

    scoreCard.holes.forEach((hole, index) => {
      const holeField = `H${String(index + 1).padStart(2, '0')}`; // Format H01, H02, ..., H18
      holeUpdates[holeField] = hole.holeScore; 
    });

    // Update the document with the hole scores
    await playerDocRef.update(holeUpdates);

    console.log(`Updated hole scores for player ${playerId} in collection ${collectionName}`);
  } catch (error) {
    console.error(`Error updating hole scores for player ${playerId} in collection ${collectionName}:`, error);
  }
};

module.exports = { updatePlayerHoleScores };