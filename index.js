const Util = require('discord.js');
const Discord = require('discord.js');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');
const prefix = "<";

const client = new Discord.Client({ disableEveryone: true });
const youtube = new YouTube(process.env.YoutubeAPI);
const queue = new Map();

const embed = new Discord.RichEmbed()
    .setColor('#808080');

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () =>
{
    client.user.setActivity('<musique');
    console.log('Ready!');
});

client.on('disconnect', () =>
{
    console.log('Disconnected, reconnecting now...');
});

client.on('reconnecting', () =>
{
    console.log('Reconnecting now!');
});

client.on('message', async message =>
{
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.split(/ +/);
    message.content = message.content.toLowerCase();
    const searchString = args.slice(1).join(' ');
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
    const serverQueue = queue.get(message.guild.id);

    if(message.content.startsWith(`${prefix}play`))
    {
        const voiceChannel = message.member.voiceChannel;
        if(!voiceChannel) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Tu dois être dans un salon vocal pour ceci !');
            return message.channel.send(embed);
        }
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if(!permissions.has('CONNECT'))
        {
            embed.setColor('#ff0000');
            embed.setDescription('Je ne peux pas rejoindre ce salon, assurez vous que j\'ai les permissions requises !');
            return message.channel.send(embed);
        }
        if(!permissions.has('SPEAK'))
        {
            embed.setColor('#ff0000');
            embed.setDescription('Je ne peux pas parler dans ce salon, assurez vous que j\'ai les permisions requises !');
            return message.channel.send(embed);
        }
        
        if(serverQueue && !serverQueue.playing && !args[1]) 
        {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return message.react('▶', 'O', 'K');
        }
        
        if(serverQueue && serverQueue.playing && !args[1])
        {
            embed.setColor('#ff0000');
            embed.setDescription('Aucuns liens ou mots clés n\'a été trouvé !!');
            return message.channel.send(embed);
        }

        if(!args[1])
        {
            embed.setColor('#ff0000');
            embed.setDescription('Aucuns liens ou mots clés n\'a été trouvé !');
            return message.channel.send(embed);
        }

        if(url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/))
        {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            let videonum = 0; 
            for(const video of videos)
            {
                try 
                {
                    ++videonum;
                    const video2 = await youtube.getVideoByID(video.id);
                    await handleVideo(video2, message, voiceChannel, true);    
                } 
                catch (error) 
                {
                    console.log(error);
                    videos.shift();
                }
            }
            embed.setColor('#808080');
            embed.setDescription(`Très bien ! ✅ [${playlist.title}](${playlist.url}) - ${videonum} musiques ont été ajoutés à la playlist !`);
            return message.channel.send(embed);
        }
        else
        {
            try 
            {
                var video = await youtube.getVideo(url);
            } 
            catch (error) 
            {
                try 
                {
                    var videos = await youtube.searchVideos(searchString, 1);
                    video = await youtube.getVideoByID(videos[0].id);
                } 
                catch (err) 
                {
                    console.error(err);
                    embed.setColor('#ff0000');
                    embed.setDescription('Aucuns résultats n\'a été trouvé.. 😥');
                    return message.channel.send(embed);
                }
            }
            return handleVideo(video, message, voiceChannel);
        }
    }
    else if(message.content.startsWith(`${prefix}search`) || message.content.startsWith(`${prefix}find`))
    {
        const voiceChannel = message.member.voiceChannel;
        if(!voiceChannel) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Tu dois être dans un salon vocal pour ceci !');
            return message.channel.send(embed);
        }
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if(!permissions.has('CONNECT'))
        {
            embed.setColor('#ff0000');
            embed.setDescription('Je ne peux pas rejoindre ce salon, assurez vous que j\'ai les permissions requises !');
            return message.channel.send(embed);
        }
        if(!permissions.has('SPEAK'))
        {
            embed.setColor('#ff0000');
            embed.setDescription('Je ne peux pas parler dans ce salon, assurez vous que j\'ai les permissions requises !');
            return message.channel.send(embed);
        }

        try 
        {
            video = await youtube.getVideo(url);
        } 
        catch (error) 
        {
            try 
            {
                videos = await youtube.searchVideos(searchString, 10);
                let index = 0;
                const searchtext = new Discord.RichEmbed()
                    .setColor('#808080')
                    .setTitle('__**Recherche de musique:**__')
                    .setDescription(`${videos.map(video2 => `**${++index} -** [${Util.escapeMarkdown(video2.title)}](${video2.url})`).join('\n')} 
                    
                    Pour choisir une musique tu peux écrire un chiffre entre 1-10.`);
                message.channel.send(searchtext);

                try 
                {
                    var response = await message.channel.awaitMessages(message2 => message2.content > 0 && message2.content < 11, {
                        maxMatches: 1,
                        time: 10000,
                        errors: ['time'],
                    });
                } 
                catch (err) 
                {
                    console.error(err);
                    embed.setColor('#ff0000');
                    embed.setDescription('Aucune réponse valide / Aucune réponse donnée annulation de la recherche.');
                    return message.channel.send(embed);
                }
                const videoIndex = parseInt(response.first().content);
                video = await youtube.getVideoByID(videos[videoIndex - 1].id);
            } 
            catch (err) 
            {
                console.error(err);
                embed.setColor('#ff0000');
                embed.setDescription('Aucun résultat trouvé pour cette recherche.');
                return message.channel.send(embed);
            }
        }
        return handleVideo(video, message, voiceChannel);
    }
    else if(message.content.startsWith(`${prefix}skip`) || message.content.startsWith(`${prefix}next`))
    {
        if(!message.member.voiceChannel) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Vous n\'êtes pas dans un salon vocal !');
            return message.channel.send(embed);
        }
        if(!serverQueue) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Il n\'y a rien a passer... 😥');
            return message.channel.send(embed);
        }
        serverQueue.connection.dispatcher.end('Très bien 👍 Je passe cette musique !');
        return;
    }
    else if(message.content.startsWith(`${prefix}stop`) || message.content.startsWith(`${prefix}leave`) || message.content.startsWith(`${prefix}disconnect`))
    {
        if(!message.member.voiceChannel) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Vous n\'êtes pas dans un salon vocal ! 😥');
            return message.channel.send(embed);
        }
        if(!serverQueue) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Il n\'y a rien a stopper. 😥');
            return message.channel.send(embed);
        }
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end('Très bien 👍 Je stop la musique !');
        return message.react('🛑');
    }
    else if(message.content.startsWith(`${prefix}np`) || message.content.startsWith(`${prefix}song`) || message.content.startsWith(`${prefix}nowplaying`) || message.content.startsWith(`${prefix}playing`) || message.content.startsWith(`${prefix}currentsong`) || message.content.startsWith(`${prefix}current`))
    {
        if(!serverQueue) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Je ne joue rien. 😥');
            return message.channel.send(embed);
        }

        let bicon = bot.user.displayAvatarURL;
        const nptext = new Discord.RichEmbed()
            .setColor('#808080')
            .setTitle('Musique Actuelle')
            .setAuthor("Vous pouvez très bien écouter la musique sur youtube en cliquant sur le titre ;)", bicon)
            .setDescription(`[${serverQueue.songs[0].title}](${serverQueue.songs[0].url}) [${serverQueue.songs[0].requested}]`);
        return message.channel.send(nptext);
    }
    else if(message.content.startsWith(`${prefix}volume`))
    {
        const voiceChannel = message.member.voiceChannel;
        if(!voiceChannel) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Tu dois être dans un salon vocal pour changer le volume !');
            return message.channel.send(embed);
        }
        if(!serverQueue) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Rien n\'est joué pour le moment. 😥');
            return message.channel.send(embed);
        }
        if(!args[1]) 
        {
            embed.setColor('#808080');
            embed.setDescription(`Volume Actuel: **${serverQueue.volume}**`);
            return message.channel.send(embed);
        }

        if(parseInt(args[1]) <= 5 && parseInt(args[1]) >= 1)
        {
            serverQueue.volume = args[1];
            serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
    
            embed.setColor('#808080');
            embed.setDescription(`Volume est maintenant de: **${serverQueue.volume}**`);
            return message.channel.send(embed);
        }
        else 
        {
            embed.setColor('#ff0000');
            embed.setDescription(`Le volume ne peut être qu'entre 1 et 5. Le volume actuel est de: **${serverQueue.volume}**`);
            return message.channel.send(embed);
        }
    }
    else if(message.content.startsWith(`${prefix}playlist`))
    {
        if(!serverQueue) 
        {
            embed.setColor('#ff0000');
            embed.setDescription('Rien n\'est actuellement joué. 😥');
            return message.channel.send(embed);
        }

        let pos = 0;
        const queuetext = new Discord.RichEmbed()
            .setColor('#808080')
            .setTitle('__**PlayList:**__')
            .setDescription(`${serverQueue.songs.map(song => `**${++pos}) ** ${song.title}`).join('\n')}
            
            **En Train de jouer:** ${serverQueue.songs[0].title}`);

        return message.channel.send(queuetext);
    }
    else if(message.content.startsWith(`${prefix}pause`))
    {
        if(serverQueue && serverQueue.playing) 
        {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return message.react('⏸', 'O', 'K');
        }
        else
        {
            embed.setColor('#ff0000');
            embed.setDescription('Il n\'y a actuellement rien de joué.');
            return message.channel.send(embed);
        }
    }
    else if(message.content.startsWith(`${prefix}resume`))
    {
        if(serverQueue && !serverQueue.playing) 
        {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return message.react('▶', 'O', 'K');
        }
        else
        {
            embed.setColor('#ff0000');
            embed.setDescription('Il n\'y a actuellement rien de joué.');
            return message.channel.send(embed);
        }
    }
    else if(message.content.startsWith(`${prefix}musique`))
    {
        const helptext = new Discord.RichEmbed()
            .setColor('#808080')
            .setTitle('Commands')
            .setDescription('- **<play [lien/titre/playlist]**: ```css\nJoue une musique choisie ou une playlist.\n```\n- **<search [titre]**:```css\nAffiche le top dix des resultats et vous permet d\'en choisir un entre un et dix.\n```\n- **<skip**: ```css\nPasse a la prochaine musique.\n```\n- **<pause**: ```css\nMet la musique en pause.\n```\n- **<playlist**: ```css\nMontre la playlist actuelle.\n```\n- **<resume**: ```css\nRe-lance la musique.\n```\n- **<np**: ```css\nPermet de voir la musique qui est joué\n```.\n- **<shuffle**: ```css\nMélange la playlist.\n```\n- **<stop**: ```css\nStoppe la musique et fait quitter le bot du salon\n```\n- **<repeat**: ```css\nPermet de faire répéter la musique.\n```\n- **<volume**: ```css\nMontre le volume actuel.\n```\n- **<volume [chiffre]**: ```css\nChange le volume, le chiffre doit être entre un et cinq.\n```');

        return message.channel.send(helptext);
    }
    else if(message.content.startsWith(`${prefix}shuffle`))
    {
        if(serverQueue && serverQueue.playing) 
        {
            shuffle(serverQueue.songs);
            return message.react('🔀');
        }
        else
        {
            embed.setColor('#ff0000');
            embed.setDescription('Rien n\'est actuellement joué.');
            return message.channel.send(embed);
        }
    }
    else if(message.content.startsWith(`${prefix}loop`) || message.content.startsWith(`${prefix}repeat`))
    {
        if(serverQueue && serverQueue.playing) 
        {
            if(serverQueue.loop == true)
            {
                serverQueue.loop = false;
                return message.react('❌');
            }
            else
            {
                serverQueue.loop = true;
                return message.react('🔁');
            }
        }
        else
        {
            embed.setColor('#ff0000');
            embed.setDescription('Rien n\'est actuellement joué.');
            return message.channel.send(embed);
        }
    }
    /* const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName)
        || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        
    if (!command) return;

    if (command.args && !args.length) 
    {
		return message.send(`You didn't provide any arguments, ${message.author}!`);
    }

    if (!cooldowns.has(command.name)) 
    {
        cooldowns.set(command.name, new Discord.Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;
    
    if (timestamps.has(message.author.id)) 
    {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
    
        if (now < expirationTime) 
        {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
        }
    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    try 
    {
        command.execute(message, args);
    } 
    catch (error) 
    {
        console.error(error);
        message.reply('There was an error trying to execute that command!');
    } */
});

async function handleVideo(video, message, voiceChannel, playlist = false)
{
    const serverQueue = queue.get(message.guild.id);
    console.log(video);
    const song = 
    {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`,
        requested: message.author,
        duration: video.duration,
    };

    console.log(song.duration);

    if(!serverQueue)
    {
        const queueConstruct = 
        {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 1,
            playing: true,
        };
        queue.set(message.guild.id, queueConstruct);

        queueConstruct.songs.push(song);

        try
        {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(message.guild, queueConstruct.songs[0]);
        } 
        catch(error)
        {
            embed.setColor('#ff0000');
            embed.setDescription(`Je ne peux pas rejoindre le salon: ${error}`);
            console.error(`Could not join the voice channel: ${error}`);
            queue.delete(message.guild.id);
            return message.channel.send(embed);
        }
    }
    else
    {
        if(!serverQueue.loop)
        {
            serverQueue.songs.push(song);
        }
        console.log(serverQueue.songs);
        if(playlist) 
        {
            return;
        }
        else 
        {
            embed.setColor('#808080');
            embed.setDescription(`✅ [${song.title}](${song.url}) a été ajouté à la playlist ! [${song.requested}]`);
            return message.channel.send(embed);
        }
    }
    return;
}

function play(guild, song)
{
    const serverQueue = queue.get(guild.id);

    if(!song)
    {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    console.log(serverQueue.songs);

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 }), { passes: 3, highWaterMark: 1, bitrate: 64000 })
    .on('end', reason => 
    {
        if(reason == 'Stream is not generating quickly enough.') 
        {
            dispatcher.end();
            console.log('Song ended!');
        }
        else 
        {
            console.log(reason);
        }
        if(serverQueue.loop && reason == 'Skip command used!')
        {
            serverQueue.loop = false;
            serverQueue.songs.shift();
        }
        else if(!serverQueue.loop)
        {
            serverQueue.songs.shift();
        }
        play(guild, serverQueue.songs[0]);
    })
    .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    
    const nptext = new Discord.RichEmbed()
        .setColor('#808080')
        .setTitle('Joue actuellement')
        .setDescription(`[${song.title}](${song.url}) **Demandée Par** [${song.requested}]`);

    serverQueue.textChannel.send(nptext);
}

function shuffle(songs) 
{
    var j, temp, i;
    for (i = songs.length - 1; i > 1; i--) 
    {
        j = Math.floor(Math.random() * (i + 1));
        while(j == 0)
        {
            j = Math.floor(Math.random() * (i + 1));
        }
        temp = songs[i];
        songs[i] = songs[j];
        songs[j] = temp;
    }
}

client.login(process.env.TOKEN);