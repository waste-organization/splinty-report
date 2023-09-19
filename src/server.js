const express = require("express");
const serverless = require("serverless-http");
const app = express();

const {getWorkHoursAverageOftheMonth, getWorkHoursToday} = require("./work.js")
app.use(express.json());
const router = express.Router();
router.get("/month", getWorkHoursAverageOftheMonth);
router.get("/day/today", getWorkHoursToday);

// const PORT = 4040;
// app.listen(PORT, () => {
//     console.log(`Listening on PORT ${PORT} >>>>>>>>>>>`)
// })

app.use("/.netlify/functions/server", router);


module.exports.handler = serverless(app)