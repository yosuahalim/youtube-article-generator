import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DOMPurify from "dompurify";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ArticleResponse {
  article: string;
}

interface ErrorResponse {
  error: string;
}

export default function Home() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [article, setArticle] = useState<string>("");
  const [sanitizedHtml, setSanitizedHtml] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [startTime, setStartTime] = useState<string>(""); // Empty by default

  useEffect(() => {
    if (article) {
      const cleanHtml = DOMPurify.sanitize(article);
      setSanitizedHtml(cleanHtml);
    }
  }, [article]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTranscript(""); // Reset transcript on new submission
    setArticle(""); // Reset article on new submission

    try {
      const startSeconds = startTime ? parseTime(startTime) : 0; // If empty, default to 0 (start from the beginning)

      // Step 1: Get transcript from YouTube video
      const transcriptResponse = await axios.get<{ transcript: string }>(
        "/api/transcript",
        {
          params: { videoUrl },
        }
      );

      const { transcript } = transcriptResponse.data;

      if (!transcript) {
        throw new Error("No transcript available");
      }

      const formattedTranscript = parseXmlTranscript(transcript, startSeconds); // Pass startMinute to parsing

      setTranscript(formattedTranscript);

      // Step 2: Send transcript to OpenAI for article generation
      const articleResponse = await axios.post<ArticleResponse | ErrorResponse>(
        "/api/generate-article",
        { transcript: formattedTranscript }
      );

      if ("article" in articleResponse.data) {
        setArticle(articleResponse.data.article);
      } else {
        console.error("Error:", articleResponse.data.error);
      }
    } catch (error) {
      console.error("Error generating article:", error);
    } finally {
      setLoading(false);
    }
  };

  // Function to parse the mm:ss input to seconds
  const parseTime = (time: string): number => {
    const [minutes, seconds] = time.split(":").map(Number);
    return minutes * 60 + (seconds || 0); // Convert minutes and seconds to total seconds
  };

  // Utility function to decode HTML entities
  const decodeHtmlEntities = (text: string): string => {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  };

  // Function to parse and format the XML transcript into 5-minute blocks
  const parseXmlTranscript = (xmlString: string, startSecond: number) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const textNodes = xmlDoc.getElementsByTagName("text");

    let formattedTranscript = "";
    let currentBlock = "";
    let currentBlockStart = 0; // Keep track of the start of each 5-minute block
    const blockDuration = 5 * 60; // 5 minutes in seconds

    for (let i = 0; i < textNodes.length; i++) {
      const rawText = textNodes[i].textContent || "";
      const text = decodeHtmlEntities(rawText); // Decode HTML entities here
      const startTime = parseFloat(textNodes[i].getAttribute("start") || "0");

      // Skip the transcript until we reach the startSecond
      if (startTime < startSecond) continue;

      if (startTime >= currentBlockStart + blockDuration) {
        // When 5 minutes have passed, append the current block to the formatted transcript
        const minutes = Math.floor(currentBlockStart / 60);
        const seconds = Math.floor(currentBlockStart % 60);
        const timestamp = `[${minutes}:${seconds < 10 ? "0" : ""}${seconds}]`;

        formattedTranscript += `${timestamp}\n${currentBlock.trim()}\n\n`;

        // Reset for the next block
        currentBlockStart = startTime;
        currentBlock = "";
      }

      currentBlock += `${text} `;
    }

    // Add any remaining transcript at the end
    if (currentBlock.trim() !== "") {
      const minutes = Math.floor(currentBlockStart / 60);
      const seconds = Math.floor(currentBlockStart % 60);
      const timestamp = `[${minutes}:${seconds < 10 ? "0" : ""}${seconds}]`;

      formattedTranscript += `${timestamp}\n${currentBlock.trim()}\n\n`;
    }

    return formattedTranscript.trim();
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto shadow-lg p-6">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold mb-4">
            Generate Article from YouTube Video
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Enter YouTube Video URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required
              className="w-full"
            />
            <Input
              type="text"
              placeholder="Enter Start Time (optional) mm:ss"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)} // Track mm:ss input
              className="w-full"
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Generating..." : "Generate Article"}
            </Button>
          </form>

          {/* Display the fetched transcript */}
          {transcript && (
            <div className="mt-6">
              <Accordion type="single" collapsible>
                <AccordionItem value="transcript">
                  <AccordionTrigger className="text-lg font-medium mb-2">
                    Transcript
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="bg-gray-100 p-4 rounded-md whitespace-pre-line leading-7">
                      <p>{transcript}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {/* Display the generated article */}
          {article && (
            <div className="mt-6">
              <Accordion type="single" collapsible>
                <AccordionItem value="transcript">
                  <AccordionTrigger className="text-lg font-medium mb-2">
                    Generated Article:
                  </AccordionTrigger>
                  <AccordionContent>
                    <div
                      className="prose bg-gray-100 p-4 rounded-md"
                      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
