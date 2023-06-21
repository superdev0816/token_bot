# Installation & Configuration

To install the bot, you need to have NodeJS v16 installed and NPM on your machine.
Once you're ready, browse to the folder where you have the bot. And run "npm install".

This will install all needed dependencies. Once the setup is complete, you can move on to configuration.

## Configuration

If you want to change anything in the configuration file, you can do so by editing the ".env" file located in the "discord-bot" folder. You can do that using "nano .env". This will open the config file in a text editor.

Once you're done editing the env file, you can exit the editor by pressing "CTRL + X". It will ask you if you want to save the file. Press enter and it will automatically save it for you.


# Running
To run the bot, login to the VPS, browse to the folder "discord-bot" using cd. e.g. "cd discord-bot/".

## Screen

If the bot is already running, you will have to stop it. The bot is being ran in a screen so that it runs 24/7.
To enter the screen of the bot, type "screen -r". Once in the screen, you can shutdown the bot by pressing CTRL + C, like a regular console.

## Startup

Once you are sure that there is no screen running with the bot. You can proceed with starting the bot up.
You do that by running the following command: "screen node index.js". This will start the bot in a "screen".

Before you leave your VPS, make sure to press "CTRL + A + D". This will "detach" your terminal from the screen, and will let the bot run constantly. Once again, to go back to the screen, type "screen -r".
