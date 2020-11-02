const puppeteer = require('puppeteer');
const fs = require('fs');
const config = require('./config.json');
const { delay, result } = require('lodash');
const fetch = require('node-fetch');
const { exit } = require('process');
// const cookies = require('cookies.json');

(async () => {

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox']
    });
    const page = await browser.newPage();
    // page.setUserAgent(
    //     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36'
    // );
    const url = 'http://fandl.football.cbssports.com/office-pool/make-picks';

    await page.goto(url, { waitUntil: 'networkidle2' });

    console.log('Logging in...');
    await page.type('#userid', config.email, { delay: 50 });
    await page.type('#password', config.pass, { delay: 50 });

    await page.click('.formButton');

    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    const analysisLinks = await page.$$('.gamePreview');

    console.log('Logged in successfully. \n Gathering analysis links for each game...');

    var allGames;

    if (analysisLinks.length > 0) {
        for (var i = 0; i < analysisLinks.length; i++) {
            analysisLinks[i].click();
            console.log('Waiting for selector...');
            await page.waitForSelector('.awayTeam .teamInfoLocation');
            console.log("Done.");
            try {

                const matchUp = await page.evaluate(() =>
                    Array.from(document.querySelectorAll("#gamePreviewDialogPopup #officePoolMatchupAnalysis")).map(game => ({
                        match_date: game.querySelector("#topBar .date").innerText,
                        away_location: game.querySelector(".awayTeam .teamInfoLocation").innerText,
                        home_location: game.querySelector(".homeTeam .teamInfoLocation").innerText,
                        away_nickname: game.querySelector(".awayTeam .teamInfoNickname").innerText,
                        home_nickname: game.querySelector(".homeTeam .teamInfoNickname").innerText,
                        away_wins: parseInt(game.querySelector(".awayTeam .teamInfoRecord").innerText.split('-')[0]),
                        home_wins: parseInt(game.querySelector(".homeTeam .teamInfoRecord").innerText.split('-')[0]),
                        away_losses: parseInt(game.querySelector(".awayTeam .teamInfoRecord").innerText.split('-')[1]),
                        home_losses: parseInt(game.querySelector(".homeTeam .teamInfoRecord").innerText.split('-')[1]),
                        away_ties: game.querySelector(".awayTeam .teamInfoRecord").innerText.split('-')[2] != null ? parseInt(game.querySelector(".awayTeam .teamInfoRecord").innerText.split('-')[2]) : 0,
                        home_ties: game.querySelector(".homeTeam .teamInfoRecord").innerText.split('-')[2] != null ? parseInt(game.querySelector(".homeTeam .teamInfoRecord").innerText.split('-')[2]) : 0,
                        away_power_rank: parseInt(game.querySelectorAll(".scrollableSection .awayTeam .statItem .statValue")[2].innerText.replace(/(\d+)(st|nd|rd|th)/, "$1")),
                        home_power_rank: parseInt(game.querySelectorAll(".scrollableSection .homeTeam .statItem .statValue")[2].innerText.replace(/(\d+)(st|nd|rd|th)/, "$1")),
                        away_ppg: parseFloat(game.querySelectorAll("#keyStatsBar .keyStatsCell")[1].innerText),
                        home_ppg: parseFloat(game.querySelectorAll("#keyStatsBar .keyStatsCell")[3].innerText),
                        away_papg: parseFloat(game.querySelectorAll("#keyStatsBar .keyStatsCell")[6].innerText),
                        home_papg: parseFloat(game.querySelectorAll("#keyStatsBar .keyStatsCell")[8].innerText),
                        away_ypg: parseFloat(game.querySelectorAll("#keyStatsBar .keyStatsCell")[11].innerText),
                        home_ypg: parseFloat(game.querySelectorAll("#keyStatsBar .keyStatsCell")[13].innerText),
                        away_yapg: parseFloat(game.querySelectorAll("#keyStatsBar .keyStatsCell")[16].innerText),
                        home_yapg: parseFloat(game.querySelectorAll("#keyStatsBar .keyStatsCell")[18].innerText),
                        away_tally: null,
                        home_tally: null,
                        my_pick: null,
                        winner: null
                    })),
                );

                // Worse case - just pick the home team.
                let pickHome = true;

                // Points awarded for having the better stat
                // will compare totals in the end for the choice.
                let awayMerits = 0;
                let homeMerits = 0;

                var homeGameTotal = parseInt(matchUp[0]["home_wins"] + matchUp[0]["home_losses"] + matchUp[0]["home_ties"]);
                var awayGameTotal = parseInt(matchUp[0]["away_wins"] + matchUp[0]["away_losses"] + matchUp[0]["away_ties"]);
                // ^^^ Make sure the games played are the same for a fair comparison vvv
                if (homeGameTotal == awayGameTotal) {
                    if (parseInt(matchUp[0]["home_wins"]) > parseInt(matchUp[0]["away_wins"])) {
                        homeMerits += 1;
                    }
                    if (parseInt(matchUp[0]["home_wins"]) < parseInt(matchUp[0]["away_wins"])) {
                        awayMerits += 1;
                    }
                }
                // **** MIGHT REMOVE
                if (parseInt(matchUp[0]["home_power_rank"]) < parseInt(matchUp[0]["away_power_rank"])) {
                    homeMerits += 1;
                }
                if (parseInt(matchUp[0]["away_power_rank"]) < parseInt(matchUp[0]["home_power_rank"])) {
                    awayMerits += 1;
                }
                // **** MIGHT REMOVE ^^

                if (parseFloat(matchUp[0]["home_ppg"]) > parseFloat(matchUp[0]["away_ppg"])) {
                    homeMerits += 1;
                }
                if (parseFloat(matchUp[0]["home_ppg"]) < parseFloat(matchUp[0]["away_ppg"])) {
                    awayMerits += 1;
                }


                if (parseFloat(matchUp[0]["home_papg"]) < parseFloat(matchUp[0]["away_papg"])) {
                    homeMerits += 1;
                }
                if (parseFloat(matchUp[0]["home_papg"]) > parseFloat(matchUp[0]["away_papg"])) {
                    awayMerits += 1;
                }


                if (parseFloat(matchUp[0]["home_ypg"]) > parseFloat(matchUp[0]["away_ypg"])) {
                    homeMerits += 1;
                }
                if (parseFloat(matchUp[0]["home_ypg"]) < parseFloat(matchUp[0]["away_ypg"])) {
                    awayMerits += 1;
                }

                if (parseFloat(matchUp[0]["home_yapg"]) < parseFloat(matchUp[0]["away_yapg"])) {
                    homeMerits += 1;
                }
                if (parseFloat(matchUp[0]["home_yapg"]) > parseFloat(matchUp[0]["away_yapg"])) {
                    awayMerits += 1;
                }

                matchUp[0]["home_tally"] = homeMerits;
                matchUp[0]["away_tally"] = awayMerits;

                if (homeMerits < awayMerits) {
                    matchUp[0]["my_pick"] = "away";
                    pickHome = false;
                } else {
                    matchUp[0]["my_pick"] = "home";
                    pickHome = true;
                }

                if (i == 0) {
                    allGames = matchUp;
                } else {
                    allGames = allGames.concat(matchUp);
                }

                console.log(allGames);
                await waitForTime(500);

                await page.evaluate((pickHome) => {

                    const chooseHome = document.querySelector(".homeTeam .teamSelector .icon-round-check.icon-grey-3");
                    const chooseAway = document.querySelector(".awayTeam .teamSelector .icon-round-check.icon-grey-3");

                    if (pickHome) {
                        if (chooseHome != null) {
                            chooseHome.click();
                        }
                    } else {
                        if (chooseAway != null) {
                            chooseAway.click();
                        }
                    }

                    //done analysing stats - close popup.  
                    var closeButton = document.querySelector("#closeSnippet");
                    closeButton.click();

                }, pickHome);

            } catch (error) {
                console.log(error);
                browser.close;
            }

            if (i == analysisLinks.length - 1 && (analysisLinks.length - 1) > 0) {
                console.log('Finished.');
                await page.click("#pickSubmitContainer input#pickSubmit");
                console.log("Picks have been saved.");
                await waitForTime(2000);
                console.log("exporting to file");
                await waitForTime(500);
                try {
                    fs.writeFile(
                        './picks.json',
                        JSON.stringify(allGames, null, 2),
                        (err) => err ? console.error('\tData not written!\n', err) : console.log('\tData file updated!\n')
                    );

                    saveData(allGames);

                } catch (error) {
                    console.log("Could not write to file.\n" + error);
                }
                await page.close();
                await browser.close();
                return;
            }
        }
    } else {
        console.log("Games could not be found.\nClosing browser.");
        page.close();
        browser.close();
    }
})();

function waitForTime(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}


const saveData = async data => {
    try {
        console.log("Saving data...");

        await waitForTime(900);

        // Try to connect to API
        const apiSaveUrl = 'http://laravel-api-sports.lndo.site/api/games';
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        const jsonWithMessage = ({
            message: "saving game stats",
            data: data
        });
        var greatData = JSON.stringify(jsonWithMessage, null, 2);
        console.log("THE JSON: \n");
        console.log(greatData);
        const response = await fetch(apiSaveUrl, { method: "POST", headers: headers, body: greatData });
        if (response.status === 201) {
            console.log('Data was stored successfully!\n\n\n');
        } else {
            console.log('Error saving data to the API\nStatus Code: ' + response.status + '\n\n\n');
        }

    } catch (error) {
        console.log(error);
    }
};