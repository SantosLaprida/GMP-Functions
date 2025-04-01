const {fetchLeaderBoard, fetchScoreCard} = require("../api/golfApi");
const {getFirestore} = require("firebase-admin/firestore");

const db = getFirestore();

const processRoundTwo = async (tournamentId, year) => {

  try {
    const collectionName = "I_Cuartos";
    const leaderBoardData = await fetchLeaderBoard(1, tournamentId, year);
    const roundId = leaderBoardData.roundId;
    const roundStatus = leaderBoardData.roundStatus;
    if (roundId !== 2 || roundStatus === "Not Started") {
      console.log("The round is not In Progress or not round 2, skipping...");
      return;
    }

    const clasificacionRef  = db.collection("I_Torneos").doc(year).
      collection("Tournaments").doc(tournamentId).collection("I_Clasificacion_Cuartos");

    const clasificacionSnapshot = await clasificacionRef.get();

    if (clasificacionSnapshot.empty) {
      console.log("No players in I_Clasificacion_Cuartos, skipping round two processing.");
      return;
    }

    const cuartosRef = db.collection("I_Torneos").doc(year)
      .collection("Tournaments").doc(tournamentId)
      .collection("I_Cuartos");

    const cuartosSnapshot = await cuartosRef.get();

    if (cuartosSnapshot.empty) {
      clasificacionSnapshot.forEach(async (doc) => {
        const playerData = doc.data();
        const playerId = playerData.playerId;
    
        const playerDocRef = cuartosRef.doc(playerId);
    
        await playerDocRef.set({
          firstName: playerData.firstName,
          lastName: playerData.lastName,
          name: `${playerData.firstName} ${playerData.lastName}`,
          roundComplete: false, 
          playerId: playerId,
          order: playerData.order,
          H01: 0, H02: 0, H03: 0, H04: 0, H05: 0, H06: 0, H07: 0, H08: 0, H09: 0, H10: 0,
          H11: 0, H12: 0, H13: 0, H14: 0, H15: 0, H16: 0, H17: 0, H18: 0 
        });
    
        console.log(`Player ${playerData.firstName} ${playerData.lastName} added to I_Cuartos.`);
      });

      console.log("I_Cuartos documents created successfully.");
    }

    cuartosSnapshot.forEach(async (doc) => {
      const playerData = doc.data();
      const playerId = playerData.playerId;
      const roundId = 2;

      const scoreCard = await fetchScoreCard(1, tournamentId, year, playerId, roundId);

      if (scoreCard && scoreCard.holes) {
        await updatePlayerHoleScores(playerId, scoreCard.holes, tournamentId, year, collectionName);
        console.log(`Updated hole scores for player ${playerData.firstName} ${playerData.lastName}`);
      } else {
        console.log(`No scorecard data available for player ${playerData.firstName} ${playerData.lastName}`);
      }
    });

    console.log("Round 2 processed successfully.");

  } catch (error) {
    console.error("Error processing round 2: ", error)
  }

};

module.exports = {processRoundTwo};