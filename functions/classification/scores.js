const {getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();

const {getClassificationOrder} = require("../utils/utils");
const {getActiveTournament} = require("../utils/utils");


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

const compareScores = async (scoreSheet1, scoreSheet2,
    playerNumber1, playerNumber2) => {
  console.log("Comparing scores with", playerNumber1, playerNumber2);

  if (!scoreSheet1 || !scoreSheet2) return null;

  let result = 0;

  for (let i = 1; i <= 18; i++) {
    const holeKey = `H${String(i).padStart(2, "0")}`;
    const score1 = scoreSheet1[holeKey];
    const score2 = scoreSheet2[holeKey];

    if (score1 < score2) result++;
    else if (score1 > score2) result--;
  }

  if (result === 0) {
    for (let i = 1; i <= 18; i++) {
      const holeKey = `H${String(i).padStart(2, "0")}`;
      const score1 = scoreSheet1[holeKey];
      const score2 = scoreSheet2[holeKey];

      if (score1 < score2) return {winner: playerNumber1, loser: playerNumber2};
      if (score1 > score2) return {winner: playerNumber2, loser: playerNumber1};
    }


    const year = new Date().getFullYear().toString();
    const activeTournament = await getActiveTournament(year);

    let tournamentId;


    if (activeTournament.length > 0) {
      tournamentId = activeTournament[0];
    } else {
      console.log("No active tournament found for year:", year);
      return null;
    }


    const id1 = playerNumber1 != null ? String(playerNumber1).trim() : "";
    const id2 = playerNumber2 != null ? String(playerNumber2).trim() : "";


    if (!id1 || !id2) {
      throw new Error(`❌ compareScores: Invalid player IDs: 
        ${playerNumber1}, ${playerNumber2}`);
    }

    const order1 = await getClassificationOrder(year, tournamentId, id1);
    const order2 = await getClassificationOrder(year, tournamentId, id2);

    return order1 < order2 ?
      {winner: playerNumber1, loser: playerNumber2} :
      {winner: playerNumber2, loser: playerNumber1};
  }

  return result > 0 ?
    {winner: playerNumber1, loser: playerNumber2} :
    {winner: playerNumber2, loser: playerNumber1};
};


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

module.exports = {updatePlayerHoleScores, compareScores};
