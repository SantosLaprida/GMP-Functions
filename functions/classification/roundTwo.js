const {fetchLeaderBoard, fetchScoreCard} = require("../api/golfApi");
const {getFirestore} = require("firebase-admin/firestore");

const {createISemifinales} = require("./roundThree");
const {updatePlayerHoleScores} = require("./scores");
const {compareScores} = require("./scores");

const db = getFirestore();

const processCuartosResults = async (year, tournamentId, collectionName) => {
  try {
    const collectionRef = db
        .collection("I_Torneos")
        .doc(year)
        .collection("Tournaments")
        .doc(tournamentId)
        .collection(collectionName);

    const snapshot = await collectionRef.get();
    if (snapshot.empty) {
      console.warn("No players found in collection:", collectionName);
      return;
    }

    const playersData = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      playersData.push({
        id: doc.id,
        order: data.order,
        data: data,
      });
    });

    if (playersData.length !== 8) {
      console.error("Expected 8 players in this round, but got",
          playersData.length);
      return;
    }
    playersData.sort((a, b) => a.order - b.order);

    const matchups = [
      [0, 7], // 1 vs 8
      [1, 6], // 2 vs 7
      [2, 5], // 3 vs 6
      [3, 4], // 4 vs 5
    ];

    const winners = [];
    const losers = [];

    for (const [i1, i2] of matchups) {
      const p1 = playersData[i1];
      const p2 = playersData[i2];

      const result = await compareScores(
          p1.data,
          p2.data,
          parseInt(p1.id),
          parseInt(p2.id),
      );

      winners.push(result.winner.toString());
      losers.push(result.loser.toString());

      console.log(`Match: ${p1.id} vs ${p2.id} -> Winner: ${result.winner}`);
    }

    await createISemifinales(year, tournamentId, "I_Semifinales", winners);

    console.log("✅ Semifinales created with players:", winners);
  } catch (error) {
    console.error("Error processing cuartos results: ", error);
  }
};

const createIcuartos = async (clasificacionSnapshot, cuartosRef) => {
  try {
    for (const doc of clasificacionSnapshot.docs) {
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
        H01: 0, H02: 0, H03: 0, H04: 0, H05: 0, H06: 0,
        H07: 0, H08: 0, H09: 0, H10: 0,
        H11: 0, H12: 0, H13: 0, H14: 0, H15: 0,
        H16: 0, H17: 0, H18: 0,
      });

      console.log(`Player ${playerData.firstName} 
        ${playerData.lastName} added to I_Cuartos.`);
    }

    console.log("I_Cuartos documents created successfully.");
  } catch (error) {
    console.error("Error in createI_Cuartos function: ", error);
  }
};

const processRoundTwo = async (tournamentId, year) => {
  try {
    const leaderBoardData = await fetchLeaderBoard(1, tournamentId, year);
    const roundId = leaderBoardData.roundId;
    const roundStatus = leaderBoardData.roundStatus;
    const collectionName = "I_Cuartos";
    if (roundId !== 2 || roundStatus === "Not Started") {
      console.log("The round is not In Progress or not round 2, skipping...");
      return;
    }

    const clasificacionRef = db.collection("I_Torneos").doc(year).
        collection("Tournaments").doc(tournamentId).
        collection("I_Players_Clasificacion");

    const clasificacionSnapshot = await clasificacionRef.get();

    if (clasificacionSnapshot.empty) {
      console.log("No players in I_Players_Clasificacion");
      console.log("Skipping round two processing.");
      return;
    }

    const cuartosRef = db.collection("I_Torneos").doc(year)
        .collection("Tournaments").doc(tournamentId)
        .collection("I_Cuartos");

    const cuartosSnapshot = await cuartosRef.get();

    if (cuartosSnapshot.empty) {
      await createIcuartos(clasificacionSnapshot, cuartosRef);
    }

    for (const doc of cuartosSnapshot.docs) {
      const playerData = doc.data();
      const playerId = playerData.playerId;
      const playerDocRef = cuartosRef.doc(doc.id);
      const roundId = 2;

      const scoreCard = await fetchScoreCard(1, tournamentId, year,
          playerId, roundId);

      if (scoreCard && scoreCard.length > 0) {
        const playerScoreCard = scoreCard[0];
        const holes = playerScoreCard.holes;

        if (holes) {
          const holeUpdates = {};
          Object.keys(holes).forEach((holeNumber) => {
            const hole = holes[holeNumber];
            const holeField = `H${String(holeNumber).padStart(2, "0")}`;
            holeUpdates[holeField] = hole.holeScore;
          });

          console.log("Hole Updates:", holeUpdates);

          await updatePlayerHoleScores(playerId, holeUpdates,
              tournamentId, year, collectionName);
          console.log(`Updated hole scores for player 
            ${playerData.firstName} ${playerData.lastName}`);

          if (playerScoreCard.roundComplete === true) {
            await playerDocRef.update({
              roundComplete: true,
            });
            console.log(`Round complete updated for player 
              ${playerData.firstName} ${playerData.lastName}`);
          }
        } else {
          console.log(`No hole scores available for player 
            ${playerData.firstName} ${playerData.lastName}`);
        }
      } else {
        console.log(`No scorecard data found for player: 
          ${playerData.firstName} ${playerData.lastName}`);
      }
    }

    if (roundStatus === "Complete" || roundStatus === "Suspended" ||
      roundStatus === "Official") {
      const tournamentRef = db.collection("I_Torneos").doc(year).
          collection("Tournaments").doc(tournamentId);
      await tournamentRef.update({
        round2: "Complete",
      });
      console.log("Round 2 marked as Complete.");
      await processCuartosResults(year, tournamentId, collectionName);
    } else {
      console.log("Round 2 is still in progress. Not updating the status.");
    }

    console.log("Round 2 processed successfully.");
  } catch (error) {
    console.error("Error processing round 2: ", error);
  }
};


module.exports = {processRoundTwo};
