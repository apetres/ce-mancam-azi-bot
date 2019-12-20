const fs = require('fs');

let RESTAURANTS = JSON.parse(fs.readFileSync('restaurants.json', 'utf8'));

function save() {
    fs.writeFileSync('restaurants.json', JSON.stringify(RESTAURANTS));
}

/**
 * A Bot for Slack!
 */


/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */

function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({user: installer}, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
            }
        });
    }
}


/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN) ? './db_slack_bot_ci/' : './db_slack_bot_a/'), //use a different name if an app or CI
    };
}


/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENTID, CLIENTSECRET, and PORT in the environment');
    process.exit(1);
}


/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */
// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});


/**
 * Core bot logic goes here!
 */

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "Haideti sa mancam ceva!")
});

controller.hears(
    'help',
    'direct_message,direct_mention',
    function (bot, message) {
        const helpMessage = 'Usage:\n ' +
            '`adaug NUME` - adaugare restaurant\n' +
            '`sterg NUME` - stergere restaurant\n' +
            '`lista` - lista restaurantelor cu ponderi\n' +
            '`ce mancam azi` - alegere aleatorie a unui restaturant\n' +
            '`am mancat la NUME` - crestere ponderei pentru un restaurant';
        bot.reply(message, helpMessage);
    }
);

controller.hears(
    'adaug',
    'direct_message,direct_mention',
    function (bot, message) {
        let restaurant = message.text.replace('adaug ', '');
        RESTAURANTS.push({
            name: restaurant,
            weight: 0,
        });
        save();
        bot.reply(message, 'Restaurantul ' + restaurant + ' a fost adaugat.');
    }
);

controller.hears(
    'sterg',
    'direct_message,direct_mention',
    function (bot, message) {
        let restaurant = message.text.replace('sterg ', '');
        if (RESTAURANTS.find(existing => existing.name === restaurant)) {
            RESTAURANTS = RESTAURANTS.filter(existing => existing.name !== restaurant);
            save();
            bot.reply(message, 'Restaurantul ' + restaurant + ' a fost sters.');
        } else {
            bot.reply(message, 'Restaurantul ' + restaurant + ' nu era adaugat.');
        }
    }
);

controller.hears(
    'lista',
    'direct_message,direct_mention',
    function (bot, message) {
        let list = '';
        if (RESTAURANTS.length === 0) {
            bot.reply(message, 'Nu cunosc nici un restaurant. Adauga unu nou cu comanda "adaug".');
        } else {
            for (let i = 0; i < RESTAURANTS.length; i++) {
                list += (RESTAURANTS[i].name + ': ' + RESTAURANTS[i].weight + '\n');
            }
            bot.reply(message, list);
        }
    }
);

controller.hears(
    'ce mancam azi|ce mancam azi?|Ce mancam azi|Ce mancam azi?',
    'direct_message,direct_mention',
    function (bot, message) {
        bot.reply(message, 'Urmeaza o alegere aleatorie din restaurante existente...');
        let chosenOne = choose();
        setTimeout(() => bot.reply(message, 'Astazi comandam de la...'), 1000);
        setTimeout(() => bot.reply(message, chosenOne.name + " :tada:"), 2000);
    }
);

controller.hears(
    'am mancat la',
    'direct_message,direct_mention',
    function (bot, message) {
        let restaurant = message.text.replace('am mancat la ', '');
        let found = RESTAURANTS.find(existing => existing.name === restaurant);
        if (found) {
            found.weight++;
            save();
            bot.reply(message, 'Sansele restaurantului ' + restaurant + ' sa fie ales data urmatoare au crescut.');
        } else {
            bot.reply(message, 'Restaurantul ' + restaurant + ' nu era adaugat.');
        }
    }
);

function choose() {
    let weightedRestaurants = [];
    for (let i = 0; i < RESTAURANTS.length; i++) {
        const restaurant = RESTAURANTS[i];
        for (let j = 0; j < restaurant.weight + 1; j++) {
            weightedRestaurants.push(restaurant);
        }
    }
    return weightedRestaurants[Math.floor(Math.random() * weightedRestaurants.length)];
}
