const axios = require("axios");
const {defineString} = require("firebase-functions/params");

const rapidApiKey = defineString("RAPIDAPI_KEY");


const fetchScoreCard = async (orgId, tournId, year, playerId, roundId) => {
  try {
    const response = await axios.get("https://live-golf-data.p.rapidapi.com/scorecard", {
      params: {orgId, tournId, year, playerId, roundId},
      headers: {
        "X-RapidAPI-Key": rapidApiKey.value(),
        "X-RapidAPI-Host": "live-golf-data.p.rapidapi.com",
      },
    });
    return response.data;

  } catch (error) {
    console.error("Error fetching scorecards for round ", roundId, error);
  }
}

const fetchLeaderBoard = async (orgId, tournId, year) => {
  try {
    const response = await axios.get("https://live-golf-data.p.rapidapi.com/leaderboard", {
      params: {orgId, tournId, year},
      headers: {
        "X-RapidAPI-Key": rapidApiKey.value(),
        "X-RapidAPI-Host": "live-golf-data.p.rapidapi.com",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching leaderboard for classification: ", error);
    return;
  }
};

const fetchTournamentData = async (orgId, tournId, year) => {
  try {
    const response = await axios.get("https://live-golf-data.p.rapidapi.com/tournament", {
      params: {orgId, tournId, year},
      headers: {
        "X-RapidAPI-Key": rapidApiKey.value(),
        "X-RapidAPI-Host": "live-golf-data.p.rapidapi.com",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching tournament Data:", error);
    throw error;
  }
};

const fetchRankings = async (year, statId) => {
  try {
    const response = await axios.get("https://live-golf-data.p.rapidapi.com/stats", {
      params: {year, statId},
      headers: {
        "X-RapidAPI-Key": rapidApiKey.value(),
        "X-RapidAPI-Host": "live-golf-data.p.rapidapi.com",
      },
    });
    return response.data.rankings;
  } catch (error) {
    console.error("Error fetching rankings:", error);
    throw error;
  }
};

const fetchPlayers = async (orgId, tournId, year) => {
  try {
    const response = await axios.get("https://live-golf-data.p.rapidapi.com/tournament", {
      params: {orgId, tournId, year},
      headers: {
        "X-RapidAPI-Key": rapidApiKey.value(),
        "X-RapidAPI-Host": "live-golf-data.p.rapidapi.com",
      },
    });
    return response.data.players;
  } catch (error) {
    console.error("Error fetching Players:", error);
    throw error;
  }
};
module.exports = {fetchScoreCard, fetchLeaderBoard, fetchTournamentData,
  fetchRankings, fetchPlayers};
