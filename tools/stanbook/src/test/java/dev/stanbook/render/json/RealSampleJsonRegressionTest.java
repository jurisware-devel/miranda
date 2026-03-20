package dev.stanbook.render.json;

import static org.assertj.core.api.Assertions.assertThat;

import dev.stanbook.io.SourceDocumentReader;
import dev.stanbook.pipeline.StanbookPipeline;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class RealSampleJsonRegressionTest {
    @Test
    void html_sample_output_skips_site_chrome_and_keeps_footnotes() {
        var source = new SourceDocumentReader().read(Path.of("samples/2026_00961.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).doesNotContain("Return to Decision List");
        assertThat(json).doesNotContain("judicial restraintï¿½if");
        assertThat(json).contains("judicial restraint-if it is not necessary");
        assertThat(json).contains("\"footnotes\":[");
        assertThat(json).contains("\"label\":\"6\"");
        assertThat(json).contains("Steven B. Dow");
        assertThat(json).contains("\"hasFootnotes\":true");
    }

    @Test
    void html_summary_disposition_output_is_empty_without_structural_opinion_tags() {
        var source = new SourceDocumentReader().read(Path.of("samples/2004_00098.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"officialCitation\":\"1 NY3d 591\"");
        assertThat(json).contains("\"decisionDate\":\"2004-01-12\"");
        assertThat(json).contains("\"opinions\":[]");
        assertThat(json).contains("\"disposition\":null");
        assertThat(json).contains("\"opinions\":\"fallback_only\"");
        assertThat(json).contains("\"opinionFallbackReasons\":[\"no_structured_opinion_blocks_detected\"");
        assertThat(json).contains("\"opinionLines\":[");
        assertThat(json).contains("On review of submissions pursuant to section 500.4 of the Rules");
        assertThat(json).doesNotContain("Return to Decision List");
    }

    @Test
    void html_sample_output_preserves_separate_opinion_labels() {
        var source = new SourceDocumentReader().read(Path.of("samples/2026_00963.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"decisionDate\":\"2026-02-19\"");
        assertThat(json).contains("\"author\":\"Troutman\"");
        assertThat(json).contains("\"joiners\":[\"Garcia\",\"Singas\",\"Cannataro\",\"Halligan\"]");
        assertThat(json).contains("\"label\":\"RIVERA, J. (concurring):\"");
        assertThat(json).contains("\"joiners\":[\"Wilson\"]");
        assertThat(json).contains("I join in the result and would affirm defendant's conviction");
        assertThat(json).contains("\"hasSeparateOpinions\":true");
        assertThat(json).contains("\"structuredExtraction\":{\"opinions\":\"high_confidence\"");
    }

    @Test
    void html_sample_output_preserves_official_page_marker_content_in_blocks() {
        var source = new SourceDocumentReader().read(Path.of("samples/2003_17888.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"officialCitation\":\"1 NY3d 269\"");
        assertThat(json).contains("\"decisionDate\":\"2003-10-28\"");
        assertThat(json).contains("{**1 NY3d at 272}");
        assertThat(json).contains("\"type\":\"page_marker\"");
        assertThat(json).contains("\"text\":\" OPINION OF THE COURT\"");
        assertThat(json).contains("Graffeo, J.");
        assertThat(json).contains("\"joiners\":[\"Kaye\",\"Ciparick\",\"Rosenblatt\",\"Read\"]");
        assertThat(json).contains("\"disposition\":{");
        assertThat(json).contains("\"text\":\"Chief Judge Kaye and Judges Ciparick, Rosenblatt and Read concur with Judge Graffeo;");
        assertThat(json).contains("G.B. Smith, J. (dissenting).");
    }

    @Test
    void html_sample_with_unrecognized_title_shape_emits_qa_warning() {
        var source = new SourceDocumentReader().read(Path.of("samples/2025_05785.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"title\":null");
        assertThat(json).contains("\"code\":\"missing_case_title\"");
        assertThat(json).contains("\"code\":\"case_title_extraction_failed\"");
    }
}
