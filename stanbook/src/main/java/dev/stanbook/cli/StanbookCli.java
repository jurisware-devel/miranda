package dev.stanbook.cli;

import dev.stanbook.io.SourceDocumentReader;
import dev.stanbook.pipeline.StanbookPipeline;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

public final class StanbookCli {
    private StanbookCli() {}

    public static void main(String[] args) {
        int exitCode = run(args, System.out, System.err);
        if (exitCode != 0) {
            System.exit(exitCode);
        }
    }

    static int run(String[] args, PrintStream out, PrintStream err) {
        if (args.length != 1) {
            err.println("Usage: stanbook <path>");
            return 2;
        }

        Path path = Path.of(args[0]);
        if (Files.isDirectory(path)) {
            return renderDirectory(path, err);
        }

        if (!Files.isRegularFile(path)) {
            err.println("Not a file or directory: " + path);
            return 2;
        }

        String lowerName = path.getFileName().toString().toLowerCase();
        if (!lowerName.endsWith(".htm") && !lowerName.endsWith(".html")) {
            err.println("Expected an .htm or .html file: " + path);
            return 2;
        }

        out.print(renderFile(path));
        return 0;
    }

    private static int renderDirectory(Path root, PrintStream err) {
        List<Path> htmlFiles;
        try (Stream<Path> paths = Files.walk(root)) {
            htmlFiles = paths
                .filter(Files::isRegularFile)
                .filter(StanbookCli::isHtmlFile)
                .sorted(Comparator.naturalOrder())
                .toList();
        } catch (IOException exception) {
            err.println("Failed to read directory: " + root);
            return 1;
        }

        int processed = 0;
        int failed = 0;
        for (Path htmlFile : htmlFiles) {
            Path jsonFile = siblingJsonPath(htmlFile);
            err.println("stanbook: " + htmlFile + " -> " + jsonFile);
            try {
                Files.writeString(jsonFile, renderFile(htmlFile), StandardCharsets.UTF_8);
                processed += 1;
            } catch (Exception exception) {
                err.println("stanbook: failed for " + htmlFile);
                try {
                    Files.deleteIfExists(jsonFile);
                } catch (IOException ignored) {
                    // Best effort cleanup after a failed write.
                }
                failed += 1;
            }
        }

        err.println("stanbook-dir: wrote " + processed + " JSON file(s)");
        if (failed > 0) {
            err.println("stanbook-dir: " + failed + " file(s) failed");
            return 1;
        }
        return 0;
    }

    private static String renderFile(Path path) {
        var reader = new SourceDocumentReader();
        var pipeline = StanbookPipeline.createDefault();
        var source = reader.read(path);
        return pipeline.render(source);
    }

    private static boolean isHtmlFile(Path path) {
        String lowerName = path.getFileName().toString().toLowerCase();
        return lowerName.endsWith(".htm") || lowerName.endsWith(".html");
    }

    private static Path siblingJsonPath(Path htmlFile) {
        String fileName = htmlFile.getFileName().toString();
        int extensionIndex = fileName.lastIndexOf('.');
        String jsonFileName = (extensionIndex >= 0 ? fileName.substring(0, extensionIndex) : fileName) + ".json";
        return htmlFile.resolveSibling(jsonFileName);
    }
}
