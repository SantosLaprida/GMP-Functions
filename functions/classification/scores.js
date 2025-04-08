const {getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();

const compareScores = (scoreSheet1, scoreSheet2, playerNumber1, playerNumber2) => {
  if (!scoreSheet1 || !scoreSheet2) return null;

  let matchStatus = {
    currentHole: 1,
    holesPlayed: 0,
    holesRemaining: 18,
    result: 0, 
    stillPlaying: true,
  };

  while (matchStatus.currentHole <= 18) {
    const hole = `H${matchStatus.currentHole}`;
    const score1 = scoreSheet1[hole];
    const score2 = scoreSheet2[hole];

    if (score1 === 0 || score2 === 0) {
      matchStatus.currentHole++;
      continue;
    }

    matchStatus.holesPlayed++;
    matchStatus.holesRemaining--;

    if (score1 < score2) {
      matchStatus.result--; // Player2 wins the hole
    } else if (score1 > score2) {
      matchStatus.result++; // Player1 wins the hole
    }
    // If equal, no change to result

    matchStatus.currentHole++;
  }

  // Check if all holes are completed
  matchStatus.stillPlaying = matchStatus.holesPlayed !== 18;

  // If match is complete and tied, use tiebreakers
  if (matchStatus.result === 0 && !matchStatus.stillPlaying) {
    // Tiebreaker 1: Count back (last hole won)
    for (let i = 18; i >= 1; i--) {
      const score1 = scoreSheet1[`H${i}`];
      const score2 = scoreSheet2[`H${i}`];

      if (score1 < score2) {
        matchStatus.result = -1;
        return matchStatus;
      }
      if (score1 > score2) {
        matchStatus.result = 1;
        return matchStatus;
      }
    }

    // Tiebreaker 2: Lower player number wins
    matchStatus.result = playerNumber1 < playerNumber2 ? 1 : -1;
  }

  
  return matchStatus;
};

const processResults = async (year, tournamentId) => {
  try {
    // Validate inputs
    if (!year || !tournamentId) {
      console.log("Year or tournamentId is missing");
      return;
    }

    // Reference to the quarter-finals players
    const cuartosRef = db.collection("I_Torneos").doc(year)
      .collection("Tournaments").doc(tournamentId)
      .collection("I_Cuartos");

    // Get all players in order
    const cuartosSnapshot = await cuartosRef.orderBy("order").get();
    if (cuartosSnapshot.empty) {
      console.log("No players in I_Cuartos");
      return;
    }

    // Create a map of players by their order (1-8)
    const players = {};
    cuartosSnapshot.forEach(doc => {
      players[doc.data().order] = {
        id: doc.id,
        name: doc.data().name, // Assuming you store player names
        ...doc.data()
      };
    });

    // Verify we have all 8 players
    if (Object.keys(players).length !== 8) {
      console.log("Need exactly 8 players for quarter-finals");
      return;
    }

    // Fetch scorecards for all players
    const playerScores = {};
    for (let i = 1; i <= 8; i++) {
      const scoreCard = await fetchScoreCard(1, tournamentId, year, players[i].id, 2);
      playerScores[i] = scoreCard ? scoreCard[0] : null;
      
      if (!playerScores[i]) {
        console.log(`Missing scorecard for player ${i}`);
        return;
      }
    }

    // Process each match
    const matches = [
      { match: "Match1", p1: 1, p2: 8 },
      { match: "Match2", p1: 2, p2: 7 },
      { match: "Match3", p1: 3, p2: 6 },
      { match: "Match4", p1: 4, p2: 5 }
    ];

    const resultsCollection = db.collection("I_Torneos").doc(year)
      .collection("Tournaments").doc(tournamentId)
      .collection("I_Cuartos_Resultados");

    // Process and save each match result
    for (const { match, p1, p2 } of matches) {
      const result = await compareScores(
        playerScores[p1].holes, 
        playerScores[p2].holes, 
        p1, 
        p2
      );

      if (!result) {
        console.log(`Could not determine winner for ${match}`);
        continue;
      }

      const winner = result.result > 0 ? p1 : p2;
      await resultsCollection.doc(match).set({
        winnerId: players[winner].id,
        winnerName: players[winner].name,
        matchResult: result,
        timestamp: FieldValue.serverTimestamp()
      });
    }

    console.log("Quarter-final results processed successfully");
    return true;
  } catch (error) {
    console.error("Error processing results: ", error);
    throw error; // Re-throw to handle in calling function
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
