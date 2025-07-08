import { Prefix } from "bases/prefix";
import Prisma from "utils/database";
import { Embed } from "utils/embed";
import { Env } from "utils/env";
import { Log } from "utils/log";
import { Markdown } from "utils/markdown";
import { Request } from "utils/request";
import commas from "utils/commas";

export default Prefix.Create({
  name: "lastfm",
  aliases: ["fm"],
  description: "Show the music that you're listening to",
  category: "Utility",
  cooldown: 5000,
  args: [{ name: "user", type: "string", description: "your lastfm username" }],
  async callback(client, message, args) {
    const userId = message.author.id;
    const key = Env.Required("lastfm").ToString();

    if (args.user) {
      const username = args.user;

      await Prisma.lastfm.upsert({
        where: { userId },
        update: { username },
        create: { userId, username },
      });
    }

    let data = args.user
      ? args.user
      : await Prisma.lastfm.findUnique({ where: { userId } });

    if (!data) {
      await message.reply(
        "You need to set your Last.fm username first with the command, e.g., `k.lastfm username`."
      );
      return;
    }

    const username = typeof data === "string" ? data : data.username;

    try {
      const recentTracksRes = await Request.Request({
        url: `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(
          username
        )}&api_key=${key}&format=json&limit=1`,
        method: "GET",
        response: "JSON",
      });

      const userInfoRes = await Request.Request({
        url: `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${encodeURIComponent(
          username
        )}&api_key=${key}&format=json&limit=1`,
        method: "GET",
        response: "JSON",
      });

      const track = recentTracksRes.recenttracks.track[0];
      if (!track) {
        await message.reply("No recent tracks found.");
        return;
      }

      const nowPlaying = track["@attr"]?.nowplaying === "true";

      const totalScrobbles = userInfoRes.user.playcount || "N/A";

      await message.reply({
        content: `**${username}** ${
          nowPlaying ? "is playing" : "last played"
        } ${Markdown.Link(track.url, track.name)} by ${track.artist["#text"]}`,
        embeds: [
          Embed.Create({
            title: `${track.name} — ${track.artist["#text"]}`,
            description: `Album: **${
              track.album["#text"] || "Not found"
            }** ・ Scrobbles: **${commas(totalScrobbles)}**`,
            url: track.url,
            thumb: track.image[2]["#text"],
          }),
        ],
      });
    } catch (error) {
      Log.Write("Last.fm API error:", "red");
      Log.Write(error, "red");
      await message.reply(
        "Failed to fetch Last.fm data. Please check your username or try again later."
      );
    }
  },
});
