package dev.stanbook.io;

import static org.assertj.core.api.Assertions.assertThat;

import dev.stanbook.ir.html.HtmlOpinionBlockType;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class HtmlSourceLoaderTest {
    @Test
    void loads_html_sample_into_normalized_source_lines() {
        var reader = new SourceDocumentReader();
        var document = reader.read(Path.of("samples/2026_00961.htm"));

        assertThat(document.htmlDocument()).isNotNull();
        assertThat(document.lines()).isNotEmpty();
        assertThat(document.lines().getFirst().text()).isEqualTo("People v Shaw");
        assertThat(document.lines()).anyMatch(line -> line.text().equals("Footnotes"));
        assertThat(document.lines()).anyMatch(line -> line.text().contains("judicial restraint-if it is not necessary"));
        assertThat(document.lines()).noneMatch(line -> line.text().contains("Return to Decision List"));
        assertThat(document.lines()).noneMatch(line -> line.text().contains("[FN1]"));
        assertThat(document.htmlDocument().opinionBlocks()).extracting(block -> block.type())
            .contains(HtmlOpinionBlockType.AUTHOR_MARKER, HtmlOpinionBlockType.BLOCK_QUOTE);
    }

    @Test
    void leaves_loose_br_separated_body_unparsed_when_no_structural_opinion_tags_exist() {
        var reader = new SourceDocumentReader();
        var document = reader.read(Path.of("samples/2004_00098.htm"));

        assertThat(document.htmlDocument()).isNotNull();
        assertThat(document.htmlDocument().opinionBlocks()).isEmpty();
    }
}
