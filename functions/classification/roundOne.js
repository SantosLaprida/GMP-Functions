
const {fetchLeaderBoard} = require("../api/golfApi");
const {getFirestore} = require("firebase-admin/firestore");

const db = getFirestore();


exports.processClassification = async (tournamentId, year) => {
  try {
    const leaderBoardData = await fetchLeaderBoard(1, tournamentId, year);

    const roundId = leaderBoardData.roundId;
    const roundStatus = leaderBoardData.roundStatus;
    if (roundId !== 1 || roundStatus === "Not Started") {
      console.log("The round is not In Progress or not round 1, skipping...");
      return;
    }

    const topPlayers = leaderBoardData.leaderboardRows;

    const playersCollectionRef = db
        .collection("I_Torneos")
        .doc(year)
        .collection("Tournaments")
        .doc(tournamentId)
        .collection("I_Players_Clasificacion");

    const snapshot = await playersCollectionRef.get();
    snapshot.forEach(async (doc) => {
      await doc.ref.delete();
    });


    for (let i = 0; i < topPlayers.length; i++) {
      const player = topPlayers[i];

      const holesPlayed =
        player.thru === "F" ? 18 : parseInt(player.thru) || 0;

      await playersCollectionRef.add({
        playerId: player.playerId,
        firstName: player.firstName,
        lastName: player.lastName,
        name: `${player.firstName} ${player.lastName}`,
        roundComplete: player.roundComplete,
        score: player.currentRoundScore,
        order: i + 1,
        holesPlayed: holesPlayed,
      });
    }

    if (roundStatus === "Complete" || roundStatus === "Suspended" ||
        roundStatus === "Official") {
      const tournamentRef = db.collection("I_Torneos").doc(year).
          collection("Tournaments").doc(tournamentId);
      await tournamentRef.update({
        round1: "Complete",
      });
      console.log("Round 1 marked as Complete.");
    } else {
      console.log("Round 1 is still in progress. Not updating the status.");
    }

    console.log("Classification processed successfully.");
  } catch (error) {
    console.error("Error processing classification:", error);
    return;
  }
};
