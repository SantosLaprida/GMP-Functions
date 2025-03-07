// const admin = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");
// const serviceAccount = require("./config/serviceAccount.json");

const {getActiveTournament} = require("./functions/utils/utils");
const {getNextTournament} = require("./functions/utils/utils");

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });

const db = getFirestore();

/**
 * This function tests the getActiveTournament method.
 * It fetches the active tournament for a given year and logs the result.
 * @param {string} year - The year for which the active tournament is fetched.
 */
async function test() {
  try {
    const year = "2025";
    const result = await getActiveTournament(year);

    if (result.length > 0) {
      const docId = result[0];

      const docSnap = await db.collection("I_Torneos").doc(year).
          collection("Tournaments").doc(docId).get();

      if (docSnap.exists) {
        console.log("Document data:", docSnap.data());
        const order = docSnap.data().order;
        const docToActivate = await getNextTournament(year, order);
        console.log(docToActivate);
        const documentSnapshot = await db.collection("I_Torneos").doc(year)
            .collection("Tournaments").doc(docToActivate).get();

        console.log(documentSnapshot.data());
      } else {
        console.log("No such document!");
      }
    } else {
      console.log("No active tournaments found");
    }
  } catch (error) {
    console.error("Error testing active tournament:", error);
  }
}

test();
