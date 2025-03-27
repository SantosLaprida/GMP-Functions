const {logger} = require("firebase-functions");
const {getFirestore} = require("firebase-admin/firestore");

const {fetchTournamentData} = require("../api/golfApi");
const {getActiveTournament} = require("../utils/utils");
const {processClassification} = require("./roundOne");
const {processRoundTwo} = require("./roundTwo");

const db = getFirestore();

const handleRound1 = async (tournamentRef, tournamentDoc, tournId, year) => {
  const {round1} = tournamentDoc;

  if (round1 === "Complete") {
    logger.log("Round 1 already complete");
    return;
  }

  if (round1 === "Not Started") {
    await tournamentRef.update({round1: "In Progress"});
    logger.log("Round 1 marked as In Progress");
  }

  await processClassification(tournId, year);
  logger.log("Classification processed");
};

const handleRound2 = async (tournamentRef, tournamentDoc, tournId, year) => {
  const {round1, round2} = tournamentDoc;

  if (round1 !== "Complete") {
    logger.log("Round 1 not complete, reprocessing classification");
    await processClassification(tournId, year);
    logger.log("Round 1 reprocessed");
  }

  if (round2 === "Complete") {
    logger.log("Round 2 already complete");
    return;
  }

  if (round2 === "Not Started") {
    await tournamentRef.update({round2: "In Progress"});
    logger.log("Round 2 marked as In Progress");
  }
  await processRoundTwo(tournId, year);
};

const handleRoundProcessing = async (tournamentSnapshot, tournamentData,
    tournId, year) => {
  const {currentRound} = tournamentData;
  const tournamentDoc = tournamentSnapshot.data();

  switch (currentRound) {
    case 1:
      await handleRound1(tournamentSnapshot.ref, tournamentDoc, tournId, year);
      break;
    case 2:
      await handleRound2(tournamentSnapshot.ref, tournamentDoc, tournId, year);
      break;
    // Add cases for round 3 and 4 as needed
    default:
      logger.log(`No processing defined for round ${currentRound}`);
  }
};

const processRounds = async () => {
  const year = new Date().getFullYear().toString();

  const tournamentId = await getActiveTournament(year);
  if (tournamentId.length > 0) {
    logger.log("No active tournament found");
    return;
  }

  const tournId = tournamentId[0];
  const tournamentRef = db.collection("I_Torneos").doc(year)
      .collection("Tournaments").doc(tournId);

  const tournamentSnapshot = await tournamentRef.get();
  if (!tournamentSnapshot.exists) {
    logger.log("Tournament document doesn't exist");
    return;
  }

  const tournamentData = await fetchTournamentData(1, tournId, year);
  if (tournamentData.status === "Not Started") {
    logger.log("Tournament not started");
    return;
  }

  await handleRoundProcessing(tournamentSnapshot, tournamentData,
      tournId, year);
};

module.exports = {handleRound1, handleRound2,
  handleRoundProcessing, processRounds};
