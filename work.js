const axios = require("axios");
const constants = require("./constants.js");
const { raw } = require("express");

async function getAccessHistory(auth, yearAndMonth) {
    const [year, month] = yearAndMonth.split("-");
    let nextYear = year;
    let nextMonth = parseInt(month) + 1;
    nextMonth = nextMonth > 9 ? "" + nextMonth : "0" + nextMonth;
    if (month == "12") {
        nextYear = "" + (parseInt(year) + 1);
        nextMonth = "01";
    }
    const startOftheMonth = new Date(`${yearAndMonth}-01T00:00:00`).toISOString();
    const startOftheMonthUTC = new Date(`${startOftheMonth.split(".")[0]}+05:30`).toISOString();
    const endOftheMonth = new Date(`${nextYear}-${nextMonth}-01T00:00:00+00:01`).toISOString();
    const endOftheMonthUTC = new Date(`${endOftheMonth.split(".")[0]}+05:30`).toISOString();

    const payload = {
        filters: {
            employeeId: "",
            name: "",
            location: "",
            start: `${startOftheMonth.split("T")[0]} 00:00:00 +05:30`,
            end: `${endOftheMonth.split("T")[0]} 23:59:59 +05:30`,
            sites: [],
            eventTypes: null,
            accessRange: {
                startDate: startOftheMonthUTC,
                endDate: endOftheMonthUTC
            },
            terms: []
        }
    }
    const config = {
        method: "POST",
        url: "https://saams.api.spintly.com/organisationManagement/v11/organisations/3029/accessHistory",
        headers: {
            Authorization: auth,
            Accept: "application/json"
        }
    }

    let gotoNextPage = true;
    let page = 0;
    const monthAccessHistory = [];
    while (gotoNextPage) {
        payload.pagination = {
            page: ++page,
            perPage: constants.DEFAULT_PER_PAGE
        }
        config.data = payload;

        try {
            console.log("api options :: ", config);
            const { data: { message: { accessHistory, pagination: { total } } } } = await axios(config);
            if (total < constants.DEFAULT_PER_PAGE || !accessHistory.length) {
                gotoNextPage = false;
            }

            monthAccessHistory.push(...accessHistory);
        } catch (error) {
            error = error.message;
            console.log(error);
            if (error.status) throw { status: error.status, detail: error.message }
            throw error
        }
    }
    return monthAccessHistory;
}

async function getWorkHoursAverageOftheMonth(req, res) {
    // return res.json({message: "Under Maintainance"});
    console.log("GET /month/workHoursAverage");
    console.log("headers= ", req.headers);
    console.log("query= ", req.query);
    console.log("params= ", req.params);
    const auth = req.headers["authorization"];
    if (!auth) return res.status(401).json({ message: "Please provide authorization." });
    try {
        // Fetch data from upstream
        const accessHistory = await getAccessHistory(auth, req.query.yearAndMonth);

        const groupedDaysOftheMonth = {};

        let dayPointer = accessHistory[0]?.["createdAt"].split("T")[0];
        for (let i = 0; i < accessHistory.length - 1; i++) {
            const current = accessHistory[i];
            const createdAtDate = current?.createdAt.split("T")[0];
            if (createdAtDate == dayPointer) {
                if (!Array.isArray(groupedDaysOftheMonth[dayPointer])) groupedDaysOftheMonth[dayPointer] = [];
                if (current.direction == "exit" && i == accessHistory.length - 1) continue;
                if (current.direction == "entry" && i == 0) continue;
                else if (current.direction == "entry") {
                    groupedDaysOftheMonth[dayPointer].push((-1) * current.accessedAt);
                }
                else if (current.direction == "exit") {
                    groupedDaysOftheMonth[dayPointer].push(current.accessedAt);
                }
                continue;
            }
            dayPointer = accessHistory[i]?.["createdAt"].split("T")[0];
            i -= 1; // stay at the same index for next loop
        }

        const workHoursPerDay = {};
        const monthAverage = {
            TotalSecondsSpent: 0
        };
        const eachDay = Object.keys(groupedDaysOftheMonth)
        eachDay.forEach((day) => {
            let prev = ''
            const workHoursOfTheDay = groupedDaysOftheMonth[day].reduce((workHours, value, i, a) => {
                // if(!value) return workHours;
                if (value < 0) { // less than 0 means entry
                    if (i == 0) {
                        return workHours;
                    } else if (a[i + 1] < 0) {
                        a.splice(i + 1, 1);
                        // a[i+1] == 0;
                        // return workHours + value;
                    }
                    prev = "entry"
                    return workHours + value;
                }
                else if (value > 0) { // greater than means exit
                    if (i == a.length - 1) {
                        return workHours;
                    } else if (a[i + 1] > 0) {
                        value = 0;
                    }
                    prev == "exit";
                    return workHours + value;
                }
                // if (prev == "entry") {
                //     if (a?.[i+1] < 0) 
                //     if (true) {

                //     }
                // }
            }, 0);
            let rawHours = workHoursOfTheDay / 3600;
            workHoursPerDay[day] = {};
            workHoursPerDay[day].Hours = Math.floor(rawHours);
            workHoursPerDay[day].Minutes = Math.floor((rawHours - workHoursPerDay[day].Hours) * 60);
            workHoursPerDay[day].TotalSecondsSpent = workHoursOfTheDay;
            monthAverage.TotalSecondsSpent = monthAverage.TotalSecondsSpent + workHoursOfTheDay;
        })
        if (!eachDay.length) return res.json({});
        monthAverage.AverageSecondsSpent = monthAverage.TotalSecondsSpent / eachDay.length;
        const rawAverageHours = monthAverage.AverageSecondsSpent / 3600;
        monthAverage.Hours = Math.floor(rawAverageHours);
        monthAverage.Minutes = Math.floor((rawAverageHours - monthAverage.Hours) * 60);
        console.log(monthAverage)
        return res.json({ perDay: workHoursPerDay, monthAverage, groupedDaysOftheMonth });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500);
        return res.json({ message: error })
    }
}

async function getWorkHoursToday(req, res) {
    console.log("GET /month/workHoursAverage");
    console.log("TIME NOW :: ", new Date(`${new Date()}-05:30`));
    console.log("headers= ", req.headers);
    console.log("query= ", req.query);
    console.log("params= ", req.params);
    const auth = req.headers["authorization"];
    if (!auth) return res.status(401).json({ message: "Please provide authorization." });
    try {
        let today = new Date().toISOString();
        const todayUTC = new Date(`${today.split("T")[0]}T00:00:00+05:30`);
        today = today.split("T")[0];
        let endOftheDayUTC = new Date(`${today}T23:59:59+05:30`);
        const payload = {
            filters: {
                employeeId: "",
                name: "",
                location: "",
                start: `${today} 00:00:00 +05:30`,
                end: `${today} 23:59:59 +05:30`,
                sites: [],
                eventTypes: null,
                accessRange: {
                    startDate: todayUTC,
                    endDate: endOftheDayUTC
                },
                terms: []
            }
        }
        const config = {
            method: "POST",
            url: "https://saams.api.spintly.com/organisationManagement/v11/organisations/3029/accessHistory",
            headers: {
                Authorization: auth,
                Accept: "application/json"
            }
        }
        let dayHistory = [];
        let gotoNextPage = true;
        let page = 0;
        while(gotoNextPage) {
            payload.pagination = {
                page: ++page,
                perPage: constants.DEFAULT_PER_PAGE
            }
            config.data = payload;
    
            try {
                console.log("api options :: ", config);
                const { data: { message: { accessHistory, pagination: { total } } } } = await axios(config);
                if (total < constants.DEFAULT_PER_PAGE || !accessHistory.length) {
                    gotoNextPage = false;
                }
    
                dayHistory.push(...accessHistory);
            } catch (error) {
                error = error.message;
                console.log(error);
                if (error.status) throw { status: error.status, detail: error.message }
                throw error
            }
        }
        if (!dayHistory.length) return res.json({message: "Looks like you haven't logged in today."})
        let TotalSecondsSpent = 0;
        let prev = ""
        for (let i = 0; i < dayHistory.length; i++) {
            if (dayHistory[i]?.direction == "entry") {
                if (i == 0) {
                    const currentTime = Date.parse(new Date());
                    TotalSecondsSpent = Math.floor(currentTime/1000) - dayHistory[i]?.accessedAt;
                    continue
                }
                if (prev == "entry") {
                    continue;
                }
                prev = "entry"
                TotalSecondsSpent -= dayHistory[i]?.accessedAt;
            }
            else if(dayHistory[i]?.direction == "exit") {
                if(i == dayHistory.length - 1) continue;
                if (prev == "exit") {
                    TotalSecondsSpent = TotalSecondsSpent - dayHistory[i-1]?.accessedAt + dayHistory[i]?.accessedAt;
                    continue;
                }
                prev = "exit";
                TotalSecondsSpent += dayHistory[i]?.accessedAt;
            }
        }
        const rawHours = TotalSecondsSpent / 3600;
        const Hours = Math.floor(rawHours);
        const Minutes = Math.floor((rawHours - Hours) * 60);
        const result = {
            TotalSecondsSpent,
            Hours,
            Minutes,
            dayHistory
        }
        return res.json(result);
    } catch (error) {
        console.log(error);
        res.status(error.status || 500);
        return res.json({ message: error })
    }
}

module.exports= {
    getWorkHoursAverageOftheMonth,
    getWorkHoursToday
}