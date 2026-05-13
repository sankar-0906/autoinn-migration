import axios from 'axios';

const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtZTJmZzhhNzBlOWgwNzk3ZHhpaTNpejUiLCJicmFuY2giOlsiY2x1ODM1eDFoMGtoNDA4OTh5bm94NnFuciIsImNrOGc1ODl2ajQ5OTAwODgwNm9oOTBubXgiXSwiaWF0IjoxNzc4NTYzNzE1LCJleHAiOjE3Nzg3MzY1MTV9.iuYOiJD3o-Lz13kZwvyL9voMxPMdE7fnOL58B_U-1BeUuOaeltXu_zQi9BQd0mhbxa6jUQ1FHghzZgrn6AOdN8PzusIF3ujkV3zaSHojj6vX6fpDUHzWm28OHvQPCcLJDxY1IxjBv5xWcr1cNt3XdIzSFheAu-2HusdLtNwC8hFG_v3meb7JNaLVjHTlAd1YpkrCDwko4WbEQStiFOdEYuIQdfJmZN4KE7vUPAXMdsMhS0wfz5hWQUBH6QJBn3ikn4ksOTNjNTZYvVGRur2ZIfk_BSGIgXkVMXnGFR6R_1r8JuyDZlOI1Asr_O5tJzypRyKz930Fw2i2AAcVQzmrlA";
const id = "cmp2ml4zm0001ybegvcv8jy7v";

async function test() {
    try {
        const response = await axios.get(`http://localhost:4004/api/estimate/generatePDF/${id}?token=${token}`);
        console.log("Success!");
    } catch (error) {
        if (error.response) {
            console.log("Error status:", error.response.status);
            console.log("Error data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.log("Error:", error.message);
        }
    }
}

test();
