const {getFirestore} = require("firebase-admin/firestore");

const db = getFirestore();

exports.getActiveTournament = async (year) => {
  try {
    const querySnap = await db.collection("I_Torneos").
        doc(year).collection("Tournaments")
        .where("activo", "==", 1).get();
    if (querySnap.empty) {
      console.log("No active tournament found");
      return [];
    }

    return querySnap.docs.map((doc) => doc.id);
  } catch (error) {
    console.error("Error getting active tournament ", error);
    return;
  }
};

exports.getNextTournament = async (year, order) => {
  try {
    const querySnap = await db.collection("I_Torneos").doc(year)
        .collection("Tournaments")
        .where("order", ">", order)
        .orderBy("order")
        .limit(1)
        .get();

    if (querySnap.empty) {
      console.log("No documents found");
      return;
    } else {
      const firstDoc = querySnap.docs[0];
      return firstDoc.id;
    }
  } catch (error) {
    console.error("Error fetching the next tournament ", error);
    return;
  }
};

// node testGetActiveTournament.js
