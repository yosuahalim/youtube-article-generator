import { NextApiRequest, NextApiResponse } from "next";
import ytdl from "ytdl-core";
import axios from "axios";

interface TranscriptResponse {
  transcript: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TranscriptResponse | ErrorResponse>
) {
  const { videoUrl } = req.query as { videoUrl: string };

  try {
    // Get the YouTube video ID
    const videoId = videoUrl.split("v=")[1];
    const validateID = ytdl.validateID(videoId);

    // console.log("🚀 ~ validateID:", validateID);

    // if (!validateID) {
    //   return res.status(400).json({ error: "Invalid YouTube video URL" });
    // }

    // Fetch video info to check if captions are available
    const videoInfo = await ytdl.getInfo(videoUrl);

    // Check for captions; alternatively, you can extract audio for transcription
    const captionsTrack = videoInfo.player_response.captions;
    console.log("🚀 ~ captionsTrack:", captionsTrack);
    if (captionsTrack) {
      const captions =
        captionsTrack.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl;
      const response = await axios.get(captions);

      res.status(200).json({ transcript: response.data });
    } else {
      res.status(404).json({ error: "No captions available" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error processing video" });
  }
}
