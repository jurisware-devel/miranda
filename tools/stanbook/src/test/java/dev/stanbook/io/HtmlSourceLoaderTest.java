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
        assertThat(document.htmlDocument().fallbackOpinionLineNumbers()).isNotEmpty();
        assertThat(document.lines()).anyMatch(line -> line.text().contains("On review of submissions pursuant to section 500.4 of the Rules"));
        assertThat(document.lines()).noneMatch(line -> line.text().contains("Return to Decision List"));
    }

    @Test
    void extracts_footnote_body_without_repeating_footnote_prefix() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00003</td></tr>
            </table>
            <p>Opinion text.<sup><a href="#1FN" name="1CASE"><b>[FN1]</b></a></sup></p>
            <div align="center"><b>Footnotes</b></div>
            <a name="1FN" href="#1CASE"><b>Footnote 1:</b></a> Example footnote text.
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);

        assertThat(document.htmlDocument().footnotes()).hasSize(1);
        assertThat(document.htmlDocument().footnotes().getFirst().label()).isEqualTo("1");
        assertThat(document.lines()).anyMatch(line -> line.text().equals("Example footnote text."));
        assertThat(document.lines()).noneMatch(line -> line.text().contains("Footnote 1: Example footnote text."));
    }

    @Test
    void recognizes_chief_judge_and_inline_dissent_author_markers() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00004</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <div align="center">OPINION OF THE COURT</div>
            <p>Chief Judge Kaye.</p>
            <p>Majority text.</p>
            <p>G.B. Smith, J. (dissenting). Dissent text.</p>
            <div align="center"><b>Footnotes</b></div>
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);

        assertThat(document.htmlDocument().opinionBlocks()).extracting(block -> block.type())
            .containsSequence(
                HtmlOpinionBlockType.PARAGRAPH,
                HtmlOpinionBlockType.AUTHOR_MARKER,
                HtmlOpinionBlockType.PARAGRAPH,
                HtmlOpinionBlockType.AUTHOR_MARKER,
                HtmlOpinionBlockType.PARAGRAPH
            );
        assertThat(document.htmlDocument().opinionBlocks()).extracting(block -> block.text())
            .contains("Chief Judge Kaye.", "G.B. Smith, J. (dissenting).", "Dissent text.");
    }

    @Test
    void does_not_treat_wrapped_panel_summary_line_as_author_marker() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00005</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <div align="center">OPINION OF THE COURT</div>
            <p>Memorandum.</p>
            <p>Chief Judge Kaye and Judges G.B.
            Smith, Ciparick, Rosenblatt, Graffeo, Read and R.S. Smith concur.</p>
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);

        assertThat(document.htmlDocument().opinionBlocks()).extracting(block -> block.type())
            .containsExactly(
                HtmlOpinionBlockType.PARAGRAPH,
                HtmlOpinionBlockType.PARAGRAPH,
                HtmlOpinionBlockType.PARAGRAPH
            );
        assertThat(document.htmlDocument().opinionBlocks()).extracting(block -> block.text())
            .contains("Chief Judge Kaye and Judges G.B. Smith, Ciparick, Rosenblatt, Graffeo, Read and R.S. Smith concur.");
    }
}
