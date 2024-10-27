import { ParquetReader } from 'parquetjs';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ProcessedData {
    fileName: string;
    data: any[];  // Replace 'any' with your specific data structure
}

async function readParquetFile(filePath: string): Promise<ProcessedData> {
    try {
        const reader = await ParquetReader.openFile(filePath);
        const cursor = reader.getCursor();
        const records: any[] = [];
        
        // Read all records from the file
        let record = null;
        while (record = await cursor.next()) {
            records.push(record);
        }
        
        await reader.close();
        
        return {
            fileName: path.basename(filePath),
            data: records
        };
    } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        throw error;
    }
}

async function processParquetFiles(directoryPath: string): Promise<ProcessedData[]> {
    try {
        // Get all parquet files in the directory
        const files = await fs.readdir(directoryPath);
        const parquetFiles = files.filter(file => file.endsWith('.parquet'));
        
        // Process files in parallel using Promise.all
        const processingPromises = parquetFiles.map(file => 
            readParquetFile(path.join(directoryPath, file))
        );
        
        // Wait for all files to be processed
        const results = await Promise.all(processingPromises);
        return results;
    } catch (error) {
        console.error('Error processing directory:', error);
        throw error;
    }
}

async function mergeProcessedData(processedData: ProcessedData[]): Promise<any[]> {
    // Merge all data arrays
    const mergedData = processedData.reduce((acc, current) => {
        return [...acc, ...current.data];
    }, [] as any[]);
    
    return mergedData;
}

// Main function to orchestrate the processing
async function main() {
    try {
        const directoryPath = './parquet-files'; // Replace with your directory path
        
        console.log('Starting parquet file processing...');
        const processedFiles = await processParquetFiles(directoryPath);
        console.log(`Successfully processed ${processedFiles.length} files`);
        
        const mergedData = await mergeProcessedData(processedFiles);
        console.log(`Total records after merging: ${mergedData.length}`);
        
        // Do something with the merged data
        // For example, save to a new parquet file
        // await saveToParquet(mergedData, 'merged-output.parquet');
        
        return mergedData;
    } catch (error) {
        console.error('Error in main process:', error);
        throw error;
    }
}

// Example usage with error handling
(async () => {
    try {
        const result = await main();
        console.log('Processing completed successfully');
    } catch (error) {
        console.error('Processing failed:', error);
        process.exit(1);
    }
})();
