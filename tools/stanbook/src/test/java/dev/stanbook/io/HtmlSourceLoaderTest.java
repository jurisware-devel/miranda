package dev.stanbook.io;

import static org.assertj.core.api.Assertions.assertThat;

import dev.stanbook.ir.html.HtmlOpinionBlockType;
import dev.stanbook.ir.inline.EmphasisInline;
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
    void recognizes_multi_judge_inline_concurrence_author_markers() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00007</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <div align="center">Per Curiam.</div>
            <p>Majority text.</p>
            <p>G.B. Smith, Rosenblatt and R.S. Smith, JJ. (concurring). Concurrence text.</p>
            <div align="center"><b>Footnotes</b></div>
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);

        assertThat(document.htmlDocument().opinionBlocks()).extracting(block -> block.type())
            .containsSequence(
                HtmlOpinionBlockType.PARAGRAPH,
                HtmlOpinionBlockType.PARAGRAPH,
                HtmlOpinionBlockType.AUTHOR_MARKER,
                HtmlOpinionBlockType.PARAGRAPH
            );
        assertThat(document.htmlDocument().opinionBlocks()).extracting(block -> block.text())
            .contains("G.B. Smith, Rosenblatt and R.S. Smith, JJ. (concurring).", "Concurrence text.");
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

    @Test
    void preserves_inline_semantics_after_splitting_leading_author_marker() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00006</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <Opinion category="dissenting">
            <p><sc>RIVERA</sc>, J. (dissenting): Applying the relevant factors (<i>see People v Taranovich</i>, 37 NY2d 442 [1975]).</p>
            </Opinion>
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);
        var dissentParagraphBlock = document.htmlDocument().opinionBlocks().stream()
            .filter(block -> block.text().contains("Applying the relevant factors"))
            .findFirst()
            .orElseThrow();
        var paragraphLine = document.lines().stream()
            .filter(line -> line.text().contains("Applying the relevant factors"))
            .findFirst()
            .orElseThrow();

        assertThat(paragraphLine.text()).isEqualTo("Applying the relevant factors (*see People v Taranovich*, 37 NY2d 442 [1975]).");
        assertThat(paragraphLine.inlines()).isNotNull();
        assertThat(paragraphLine.inlines()).anyMatch(node -> node instanceof EmphasisInline);
        assertThat(dissentParagraphBlock.text()).isEqualTo("Applying the relevant factors (*see People v Taranovich*, 37 NY2d 442 [1975]).");
        assertThat(dissentParagraphBlock.lineNumber()).isEqualTo(paragraphLine.lineNumber());
    }

    @Test
    void preserves_leading_text_after_inline_author_marker_with_emphasis() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00009</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Per Curiam.</p>
            <p>Graffeo, J. (concurring in <i>McPherson</i> and dissenting in <i>Suarez</i>). The majority concludes that this text should keep its leading article.</p>
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);
        var paragraphLine = document.lines().stream()
            .filter(line -> line.text().contains("The majority concludes"))
            .findFirst()
            .orElseThrow();

        assertThat(paragraphLine.text()).isEqualTo("The majority concludes that this text should keep its leading article.");
    }

    @Test
    void normalizes_structural_opinion_heading_tags_into_author_markers() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00010</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <div align="center">OPINION OF THE COURT</div>
            <p>Majority text.</p>
            <conopnjd>Concurring opinion by Feinman, J.</conopnjd>
            <p>Feinman, J. (concurring). Concurrence text.</p>
            <disopjd>Dissenting opinion by Chief Judge Wilson.</disopjd>
            <p>Chief Judge Wilson (dissenting). Dissent text.</p>
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);

        assertThat(document.htmlDocument().opinionBlocks()).extracting(block -> block.text())
            .contains("Feinman, J. (concurring).", "Chief Judge Wilson (dissenting).");
        assertThat(document.lines()).noneMatch(line -> line.text().equals("Concurring opinion by Feinman, J."));
        assertThat(document.lines()).noneMatch(line -> line.text().equals("Dissenting opinion by Chief Judge Wilson."));
    }

    @Test
    void preserves_spaces_around_emphasized_header_appearance_text() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00011</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p><i>Kuby & Perez LLP, </i>New York City (<i>Ronald L. Kuby </i>of counsel), for appellant.</p>
            <p>Per Curiam.</p>
            <p>Body text.</p>
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);

        assertThat(document.lines()).anyMatch(line ->
            line.text().equals("*Kuby & Perez LLP,* New York City (*Ronald L. Kuby* of counsel), for appellant.")
        );
    }

    @Test
    void extracts_summary_headnotes_and_points_of_counsel_from_custom_tags() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00012</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <Summary>
              <div align="center">SUMMARY</div>
              <stmcs>Statement of Case</stmcs>
              <p>Appeal from an order of the Appellate Division.</p>
            </Summary>
            <HeadnoteBlock>
              <Headnote>
                <Classification level="1">Crimes</Classification>
                <Classification level="2">Evidence</Classification>
                <p>Headnote text.</p>
              </Headnote>
            </HeadnoteBlock>
            <CounselBlock type="points_of">
              <div align="center">POINTS OF COUNSEL</div>
              <p>Appellant point.</p>
            </CounselBlock>
            <Opinion category="per_curiam">
              <p>Memorandum.</p>
              <p>Body text.</p>
            </Opinion>
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);

        assertThat(document.htmlDocument().summarySections()).singleElement()
            .satisfies(section -> {
                assertThat(section.label()).isEqualTo("Statement of Case");
                assertThat(section.text()).isEqualTo("Appeal from an order of the Appellate Division.");
            });
        assertThat(document.htmlDocument().headnotes()).singleElement()
            .satisfies(headnote -> {
                assertThat(headnote.classifications()).containsExactly("Crimes", "Evidence");
                assertThat(headnote.text()).isEqualTo("Headnote text.");
            });
        assertThat(document.htmlDocument().pointsOfCounsel()).singleElement()
            .satisfies(point -> {
                assertThat(point.label()).isEqualTo("POINTS OF COUNSEL");
                assertThat(point.text()).isEqualTo("Appellant point.");
            });
    }

    @Test
    void extracts_para_blocked_as_block_quote_and_inherits_opinion_category_for_author_marker() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00013</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <Opinion category="dissenting">
              <p><sc>WILSON</sc>, Chief Judge: Dissent opening.</p>
              <Para type="blocked">Quoted material.</Para>
            </Opinion>
            </body></html>
            """;

        var document = new HtmlSourceLoader().load(Path.of("example.htm"), html);

        assertThat(document.htmlDocument().opinionBlocks()).extracting(block -> block.text())
            .contains("WILSON, Chief Judge (dissenting):", "Dissent opening.", "Quoted material.");
        assertThat(document.htmlDocument().opinionBlocks()).filteredOn(block -> block.text().equals("Quoted material."))
            .singleElement()
            .satisfies(block -> {
                assertThat(block.type()).isEqualTo(HtmlOpinionBlockType.BLOCK_QUOTE);
                assertThat(block.sourceTag()).isEqualTo("para");
                assertThat(block.opinionCategory()).isEqualTo("dissenting");
            });
    }

}
