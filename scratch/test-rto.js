import axios from "axios";

const BASE_URL = "http://localhost:4004/api";
const TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNrYTBvbTkyaTBwZ2wwNzgwdTh1ZmtrNm8iLCJyb2xlIjoiU1VQRVJBRE1JTiIsImlhdCI6MTc3NzYzMDI5NywiZXhwIjoxNzc3NjMzODk3fQ.ZexMuslWPPXOKWZr3SPjzKFUdoIiffXrP8b6i1VtSwJhjmIIuDo7FXjeHiT-V1_Rwq1xQCF5vfTwRVbZ-CR55qO4Tqx9WiNrqKfQIKiaAVl8T9V-inHJoJusV50jNxZVMy9f-0Naa2j_H2PUwppkscoqD0f08iFU6uojGaWP1f0Q5FIt9zNwjevVzdiYrCK-Q3Vub7dCcihOG7Qw3s9iwwIwwoYiZLvJUK03GU3R_OHiQPUd-Ut5_6pCQIYze-1-LFH2mFzn9myXxltyVuK_1jH92yWUqEwLMY4bkZKhvfh6mg1VH9KkCrWHe-LJ7I8z37BhK-pLidsrSd67Dh7YSQ";

async function testRTO() {
  try {
    console.log("Testing GET /api/rto/...");
    const res = await axios.get(`${BASE_URL}/rto/`, {
      headers: { "x-access-token": TOKEN }
    });
    console.log("RTO Response Count:", res.data.response.data.length);
    if (res.data.response.data.length > 0) {
      console.log("Sample RTO Area:", res.data.response.data[0].area);
      console.log("Sample RTO City Name:", res.data.response.data[0].city?.name);
    }
  } catch (error) {
    console.error("Test failed:", error.response ? error.response.data : error.message);
  }
}

testRTO();
