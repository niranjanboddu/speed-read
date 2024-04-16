import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { CharacterTextSplitter } from 'langchain/text_splitter';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import fs from 'fs';

const app = express();
app.use(express.json());


const [, , question] = process.argv;
const keys = JSON.parse(fs.readFileSync("C:/shared/content/config/api-keys/openai.json","utf-8"))
const myKey = keys["team-22"];
console.log(myKey)
const openai = new OpenAI({
   //apiKey: myKey,
  apiKey: '',
});

export const createStore = (docs) => {
  return MemoryVectorStore.fromDocuments(docs, new OpenAIEmbeddings());
};

export const docsFromPDF = (file) => {
  const loader = new PDFLoader(`${file}.pdf`);
  // return loader.load();
  return loader.loadAndSplit(
    new CharacterTextSplitter({
      separator: '\n',
      chunkSize: 2500,
      chunkOverlap: 200,
    })
  );
};

const loadStore = async () => {
  const applewatch = await docsFromPDF('.\\uploads\\watch');
  return createStore([...applewatch]);
};

async function query (question) {
  const store = await loadStore();
  const results = await store.similaritySearch(question, 1);

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo-16k-0613',
    temperature: 0,
    messages: [
      {
        role: 'assistant',
        content:
          'You are my assistant. Your task is to learn the documents sent to you. I will ask questions about it. The documents are about flight reservations on Singapore Airlines. When I ask a question and I say "I", that always refer to me, the one who asks the question.',
      },
      {
        role: 'user',
        content: `Respond to the question below using the given context. If the context is insufficient for an accurate answer, avoid fabricating information; instead, simply state that more context is required.
        Question: ${question}

        Context: ${results.map((r) => r.pageContent).join('\n')}`,
      },
    ],
  });
  console.log(
    `Answer: ${response.choices[0].message.content}\n\nSources: ${results
      .map((r) => r.metadata.source)
      .join(', ')}`
  );
  console.log(JSON.stringify(response));
  return response.choices[0].message.content;
};


// Get answer
app.get('/api/tbd-query', (req, res) => {
    const question = req.query.question;
    console.log(question);
    Promise.resolve(query(question)).then(
      answer=> res.send({response :  answer})
    ) ;   
});



const upload = multer({
  dest: './uploads/'
});

// Upload pdf
app.post('/api/upload', upload.single('file'),  async(req, res) => {
    
    const file = req.file;
    console.log(file);
    const tempPath = file.path;
    const targetPath = './uploads/'+file.originalname;
    const src = fs.createReadStream(tempPath);
    const dest = fs.createWriteStream(targetPath);
    src.pipe(dest);
    src.on('end', () => {
      console.log("File successfully uploaded");
      fs.unlinkSync(tempPath);
      res.send('File uploaded successfully');
    });
    src.on('error', (err) => {
      console.error('Error saving file ', err);
      res.status(500).send('Error saving file');
    })
    
  });
  
  

const port = process.env.PORT || 8080
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})

