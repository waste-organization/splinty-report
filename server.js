const express = require("express");
const app = express();

const {getWorkHoursAverageOftheMonth, getWorkHoursToday} = require("./work.js")
app.use(express.json());

app.get("/month/workHoursAverage", getWorkHoursAverageOftheMonth);
app.get("/day/today", getWorkHoursToday);

const PORT = 4040;
app.listen(PORT, () => {
    console.log(`Listening on PORT ${PORT} >>>>>>>>>>>`)
})