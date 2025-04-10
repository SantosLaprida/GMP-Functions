const {getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();

const processResults = async (year, tournamentId, roundId) => {
  try {
    if (!year || !tournamentId || !roundId) {
      console.log("Year, tournamentId, or roundId is missing");
      return;
    }

    switch (roundId) {
      case 2:
        break;

      case 3:
        break;

      case 4:
        break;

      default:
        console.log("CollectionName passed to processResults is not valid");
        return;
    }
  } catch (error) {
    console.error("Error processing results: ", error);
    throw error;
  }
};

/**
 * Update the hole scores for a specific player in a
 * given bracket collection (e.g., I_Cuartos, I_Semifinales).
 * @param {string} playerId - The player ID whose scores are being updated.
 * @param {Object} scoreCard - The scorecard object from the API response.
 * @param {string} tournamentId - The tournament ID.
 * @param {string} year - The year of the tournament.
 * @param {string} collectionName - The collection name
 * (e.g., "I_Cuartos", "I_Semifinales").
 */
const updatePlayerHoleScores = async (playerId, scoreCard,
    tournamentId, year, collectionName) => {
  try {
    if (!scoreCard) {
      console.error("No holes found in the scorecard for player:", playerId);
      return;
    }

    const bracketRef = db.collection("I_Torneos").doc(year)
        .collection("Tournaments").doc(tournamentId)
        .collection(collectionName);

    const playerDocRef = bracketRef.doc(playerId);

    const holeUpdates = {};

    // Ensure scoreCard.holes is an object or array
    Object.keys(scoreCard).forEach((holeNumber) => {
      const hole = scoreCard[holeNumber]; // Hole data for each hole
      const holeField = `${String(holeNumber).padStart(2, "0")}`;
      holeUpdates[holeField] = hole;
    });

    // Update the document with the hole scores
    await playerDocRef.update(holeUpdates);

    console.log(`Updated hole scores for player 
        ${playerId} in collection ${collectionName}`);
  } catch (error) {
    console.error("Error updating hole scores: ", error);
  }
};

module.exports = {updatePlayerHoleScores, processResults};
