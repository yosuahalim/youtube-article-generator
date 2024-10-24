import { OpenAI } from "openai";
import { NextApiRequest, NextApiResponse } from "next";
import { encoding_for_model } from "@dqbd/tiktoken";

interface ArticleResponse {
  article: string;
}

interface ErrorResponse {
  error: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY as string,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArticleResponse | ErrorResponse>
) {
  const { transcript } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: "Transcript is required" });
  }

  try {
    const maxModelTokens = 128000; // Adjust based on the model variant
    const maxResponseTokens = 5000; // Tokens allocated for the response

    // Tokens available for the prompt
    const maxPromptTokens = maxModelTokens - maxResponseTokens - 500; // Reserve some buffer

    const tokenizer = encoding_for_model("gpt-4o");

    // Function to split the transcript
    const splitTranscript = (text: string, maxTokens: number): string[] => {
      const words = text.split(" ");
      const chunks: string[] = [];
      let currentChunk = "";
      let currentTokens = 0;

      for (const word of words) {
        const wordTokens = tokenizer.encode(" " + word).length;

        if (currentTokens + wordTokens > maxTokens) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
          currentTokens = wordTokens;
        } else {
          currentChunk += " " + word;
          currentTokens += wordTokens;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }

      return chunks;
    };

    const chunks = splitTranscript(transcript, maxPromptTokens);

    const articleParts: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prompt = `You are a helpful assistant who writes detailed, well-structured articles based on transcripts.

Continue writing an article based on the following transcript chunk. Use proper HTML tags such as <h1>, <h2>, <p>, <ul>, <li>, <strong>, and <em> to format the content appropriately. Ensure the content is engaging and easy to read.

Important:

- Do not include any code blocks or code fences (like \`\`\`html or \`\`\`) in your response.
- Do not repeat content from previous chunks.
- Ensure continuity and coherence with previous sections.
- Translate the content to Bahasa.

Transcript Chunk (${i + 1}/${chunks.length}):
${chunk}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      });

      const part = response.choices[0].message?.content;
      if (part) {
        articleParts.push(part);
      }
    }

    // Combine all parts into one article
    const article = articleParts.join("\n");
    res.status(200).json({ article });

    // // Step 2: Send each chunk to OpenAI and combine the results
    // for (const chunk of chunks) {
    //   const response = await openai.chat.completions.create({
    //     model: "gpt-4o",
    //     messages: [
    //       {
    //         role: "system",
    //         content:
    //           "You are a helpful assistant. Summarize the transcript into an article.",
    //       },
    //       {
    //         role: "user",
    //         content: `Create a detailed, well-structured article based on the following transcript. Use HTML formatting with appropriate headings, subheadings, bullet points, and emphasis to enhance readability. Ensure the content is engaging and easy to read. Translate to Bahasa.
    //         Important: **Do not** include any code blocks or code fences (like \`\`\`html or \`\`\`) in your response. Output only the HTML content without any wrapping.
    //         \n\nTranscript:\n${chunk}`,
    //       },
    //     ],
    //     temperature: 0.7,
    //     max_tokens: 1500, // Adjust max tokens as needed
    //   });

    //   fullArticle += response.choices[0].message.content + "\n\n";
    // }

    // res.status(200).json({ article: fullArticle });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error generating article" });
  }
}
