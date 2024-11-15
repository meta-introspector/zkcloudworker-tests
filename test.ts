async function processCsv(csvPath: string, functionSums: FunctionStatsWithGit) {
  console.log("processCsv", csvPath);
  
  function process_record(x: any, functionSums: FunctionStatsWithGit) {
    // Your existing process_record implementation
  }

  try {
    console.log("processCsvstart", csvPath);
    
    // Create a promise that resolves when the stream processing is complete
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(csvPath)
        .pipe(parse())
        .pipe(transform((x: any) => process_record(x, functionSums)));

      // Handle stream completion
      stream.on('finish', () => {
        console.log("Stream finished");
        resolve(undefined);
      });

      // Handle stream errors
      stream.on('error', (error) => {
        console.error("Stream error:", error);
        reject(error);
      });
    });

    console.log("processCsv1", csvPath, functionSums);
  } catch (error) {
    console.warn(`Failed to process ${csvPath}: ${error}`);
    throw error; // Re-throw the error if you want to handle it at a higher level
  }

  console.log("processCsv", csvPath, functionSums);
}
