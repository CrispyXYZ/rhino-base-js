'use strict';

/**
 * base.js
 * Includes:
 * - fs: File system operations
 * - http: Network requests
 * - async: Multithreading and asynchronous processing
 * - utils: Common utilities (Base64, encoding, etc.)
 * @version 0.1.0
 * @author CrispyXYZ
 */

const base = {
    /**
     * Exports a value to a module's exports object.
     */
    exports: (mod, field, value) => {
        if (mod && mod.exports) {
            mod.exports[field] = value;
        }
    }
};

base.fs = {
    /**
     * Synchronously reads a text file.
     */
    readText: (filePath) => {
        const file = new java.io.File(filePath);
        if (!file.exists()) throw new Error(`File not found: ${filePath}`);
        
        const fis = new java.io.FileInputStream(file);
        const scanner = new java.util.Scanner(fis, "UTF-8");
        
        const result = scanner.useDelimiter("\\A").hasNext() ? scanner.next() : "";
        scanner.close(); // Closing scanner also closes the underlying fis
        return result;
    },

    /**
     * Synchronously writes a text file.
     */
    writeText: (filePath, content, append = false) => {
        const writer = new java.io.FileWriter(filePath, append);
        writer.write(content);
        writer.close();
        return true;
    },

    /**
     * Checks whether a file exists.
     */
    exists: (filePath) => new java.io.File(filePath).exists(),
    
    /**
     * Creates a directory, including any necessary but nonexistent parent directories.
     */
    mkdir: (dirPath) => new java.io.File(dirPath).mkdirs()
};

base.http = {
    /**
     * Core request method.
     */
    request: (url, method = "GET", headers = {}, body = null) => {
        const conn = new java.net.URL(url).openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(5000); // Recommended: add timeout settings
        conn.setReadTimeout(5000);

        Object.keys(headers).forEach(key => conn.setRequestProperty(key, headers[key]));

        if (body) {
            conn.setDoOutput(true);
            const os = conn.getOutputStream();
            os.write(new java.lang.String(body).getBytes("UTF-8"));
            os.close();
        }

        const status = conn.getResponseCode();
        
        // Get input stream: try InputStream first, fallback to ErrorStream
        let stream = null;
        try {
            stream = (status >= 200 && status < 300) ? conn.getInputStream() : conn.getErrorStream();
        } catch (e) {
            // In some extreme network errors, even getErrorStream throws
        }

        // --- Core fix: prevent NPE ---
        if (stream === null) {
            return { status: status, data: "" };
        }

        // Use explicit signature and try-finally to ensure resource release
        const scanner = new java.util.Scanner["(java.io.InputStream,java.lang.String)"](stream, "UTF-8");
        try {
            const data = scanner.useDelimiter("\\A").hasNext() ? scanner.next() : "";
            return { status, data };
        } finally {
            scanner.close(); // Automatically closes the associated stream
        }
    },

    /**
     * Performs an HTTP GET request.
     */
    get: (url, headers = {}) => base.http.request(url, "GET", headers),
    
    /**
     * Performs an HTTP POST request with a raw body.
     */
    post: (url, body, headers = {}) => base.http.request(url, "POST", headers, body),
    
    /**
     * Performs an HTTP POST request with a JSON payload.
     */
    postJson: (url, jsonObj, headers = {}) => {
        const defaultHeaders = Object.assign({"Content-Type": "application/json"}, headers);
        return base.http.request(url, "POST", defaultHeaders, JSON.stringify(jsonObj));
    }
};

base.async = {
    /**
     * Thread sleep (synchronous blocking).
     */
    sleep: (ms) => java.lang.Thread.sleep(ms),

    /**
     * Runs a task in a background Java thread.
     * @param {Function} taskFn The JS function to execute.
     */
    runOnThread: (taskFn) => {
        const thread = new java.lang.Thread(new java.lang.Runnable({
            run: () => {
                try {
                    taskFn();
                } catch (e) {
                    if (typeof console !== 'undefined' && console.error) {
                        console.error("[Thread Error] " + e.toString());
                    }
                }
            }
        }));
        thread.start();
        return thread; // Returns the thread object for external control (e.g., interrupt)
    },

    /**
     * Simulates setTimeout.
     */
    setTimeout: (fn, delayMs) => {
        return base.async.runOnThread(() => {
            java.lang.Thread.sleep(delayMs);
            fn();
        });
    }
};

base.utils = (function() {
    // Statically detect runtime environment, executed once during initialization
    let isAndroid = false;
    try {
        // First attempt JS native detection, then Java reflection, for compatibility across JS engines
        if (typeof android !== 'undefined' && android.util && android.util.Base64) {
            isAndroid = true;
        } else {
            java.lang.Class.forName("android.util.Base64");
            isAndroid = true;
        }
    } catch (e) {
        // If an exception is thrown, we are not on Android
        isAndroid = false;
    }

    return {
        /**
         * Base64 encoding (compatible with Android and Java 8).
         * On Android, android.util.Base64 is preferred for better performance.
         * On pure Java 8 environments, falls back to java.util.Base64.
         */
        base64Encode: (str) => {
            const bytes = new java.lang.String(str).getBytes("UTF-8");
            if (isAndroid) {
                // Android: NO_WRAP = 2
                return android.util.Base64.encodeToString(bytes, 2); 
            } else {
                // Java 8: Default Encoder already has NO_WRAP effect
                return java.util.Base64.getEncoder().encodeToString(bytes);
            }
        },

        /**
         * Base64 decoding (compatible with Android and Java 8).
         */
        base64Decode: (str) => {
            let bytes;
            if (isAndroid) {
                // Android: NO_WRAP = 2
                bytes = android.util.Base64.decode(str, 2);
            } else {
                // Java 8
                bytes = java.util.Base64.getDecoder().decode(str);
            }
            return new java.lang.String(bytes, "UTF-8").toString();
        },
        
        /**
         * Quickly get an environment variable.
         */
        env: (key, defaultValue = null) => {
            const val = java.lang.System.getenv(key);
            return val != null ? val : defaultValue;
        }
    };
})();

if (typeof module !== 'undefined') {
    module.exports = base;
}
