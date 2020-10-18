const puppeteer = require('puppeteer');
const fs = require('fs');
const config = require('./config.json');
const { delay, result } = require('lodash');
const fetch = require('node-fetch');
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

    await page.type('#userid', config.email, { delay: 50 });
    await page.type('#password', config.pass, { delay: 50 });

    await page.click('.formButton');

    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    const analysisLinks = await page.$$('.gamePreview');

    console.log(analysisLinks.length);

    var allGames;


    if (analysisLinks.length > 0) {
        for (var i = 0; i < analysisLinks.length; i++) {
            analysisLinks[i].click();
            console.log('waiting for selector...');
            await page.waitForSelector('.awayTeam .teamInfoLocation');
            console.log("done.");
            try {

                const matchUp = await page.evaluate(() =>
                    Array.from(document.querySelectorAll("#gamePreviewDialogPopup #officePoolMatchupAnalysis")).map(game => ({
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
                        my_pick: null,
                        winner: null
                    })),
                );

                // Pick based on highest score
                let pickHome = true;
                if (parseInt(matchUp[0]["home_wins"]) >= parseInt(matchUp[0]["away_wins"])) {
                    matchUp[0]["my_pick"] = matchUp[0]["home_location"];
                    pickHome = true;

                } else {
                    matchUp[0]["my_pick"] = matchUp[0]["away_location"];
                    pickHome = false;
                }

                if (i == 0) {
                    allGames = matchUp;
                } else {
                    allGames = allGames.concat(matchUp);
                }
                console.log(allGames);
                await waitForTime(500);

                // await makePick(pickHome, page);

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
                        (err) => err ? console.error('data not written!', err) : console.log('\tData file updated!')
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
        browser.close();
    }
})();

function waitForTime(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}


const saveData = async data => {
    try {
        console.log("Saving data...");
        // let jsonData = JSON.stringify(data, null, 2);
        // console.log(jsonData);
        await waitForTime(1000);
        // Try to connect to API
        const apiSaveUrl = 'http://laravel-api-sports.lndo.site/api/games';
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        const jsonWithMessage = ({
            message: "saving items",
            data: data
        });
        var greatData = JSON.stringify(jsonWithMessage, null, 2);
        console.log("THE JSON: \n");
        console.log(greatData);
        const response = await fetch(apiSaveUrl, { method: "POST", headers: headers, body: greatData });
        const json = await response.json();
        console.log(json);

    } catch (error) {
        console.log(error);
    }
};