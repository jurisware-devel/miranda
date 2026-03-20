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
        assertThat(json).contains("\"label\":\"RIVERA, J. (concurring)\"");
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

    @Test
    void html_sample_output_keeps_paulino_body_and_deduplicates_opinion_banner() {
        var source = new SourceDocumentReader().read(Path.of("samples/2025_05012.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"officialCitation\":\"44 NY3d 1039\"");
        assertThat(json).contains("Defendant was convicted of attempted murder in the second degree");
        assertThat(json).contains("\"text\":\"The order of the Appellate Division should be affirmed.\"");
        assertThat(json).contains("\"kind\":\"majority\"");
        assertThat(json).contains("\"text\":\"Memorandum.\"");
        assertThat(json).contains("\"text\":\"Defendant was convicted of attempted murder in the second degree");
        assertThat(json).doesNotContain("\"lineNumber\":9,\"text\":\"{**44 NY3d at 1039} OPINION OF THE COURT\"");
    }

    @Test
    void html_repo_sample_merges_opinion_of_the_court_prelude_into_authored_majority() {
        var source = new SourceDocumentReader().read(Path.of("../../opinions/coa/2004/2004_04439.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"officialCitation\":\"3 NY3d 80\"");
        assertThat(json).contains("\"author\":\"Ciparick\"");
        assertThat(json).contains("\"label\":\"Ciparick, J.\"");
        assertThat(json).contains("\"text\":\"{**3 NY3d at 81}\"");
        assertThat(json).contains("\"text\":\" OPINION OF THE COURT\"");
        assertThat(json).doesNotContain("\"author\":null,\"label\":null,\"joiners\":[],\"blocks\":[{\"type\":\"paragraph\"");
    }

    @Test
    void html_repo_sample_keeps_mateo_separate_opinions_and_split_summary() {
        var source = new SourceDocumentReader().read(Path.of("../../opinions/coa/2004/2004_01143.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"officialCitation\":\"2 NY3d 383\"");
        assertThat(json).contains("\"author\":\"Kaye\"");
        assertThat(json).contains("\"label\":\"Chief Judge Kaye\"");
        assertThat(json).contains("\"kind\":\"dissent\"");
        assertThat(json).contains("\"author\":\"G.B. Smith\"");
        assertThat(json).contains("\"label\":\"G.B. Smith, J. (dissenting)\"");
        assertThat(json).contains("\"label\":\"Rosenblatt, J. (dissenting)\"");
        assertThat(json).contains("\"hasSeparateOpinions\":true");
        assertThat(json).contains("Judges Ciparick, Graffeo, Read and R.S. Smith concur with Chief Judge Kaye;");
        assertThat(json).contains("Judge G.B. Smith dissents and votes to reverse and order a new trial in a separate opinion;");
        assertThat(json).contains("Judge Rosenblatt dissents and votes to reverse and order a new trial in another opinion.");
        assertThat(json).contains("\"parts\":[{\"type\":\"summary\",\"text\":\"Judges Ciparick, Graffeo, Read and R.S. Smith concur with Chief Judge Kaye; Judge G.B. Smith dissents and votes to reverse and order a new trial in a separate opinion; Judge Rosenblatt dissents and votes to reverse and order a new trial in another opinion.\"},{\"type\":\"action\",\"text\":\"Judgment modified by vacating defendant's sentence and remitting to County Court, Monroe County, for resentencing in accordance with the opinion herein and, as so modified, affirmed. Appeal from County Court order dated March 11, 1999 dismissed.\"}]");
    }

    @Test
    void html_repo_sample_ignores_dissent_signoff_when_extracting_terminal_disposition() {
        var source = new SourceDocumentReader().read(Path.of("../../opinions/coa/2005/2005_09574.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"caseId\":\"2005_09574\"");
        assertThat(json).contains("\"disposition\":{\"text\":\"Judges Ciparick, Rosenblatt, Graffeo, Read and R.S. Smith concur with Chief Judge Kaye; Judge G.B. Smith dissents and votes to reverse and order a new trial in a separate opinion. Order affirmed.\"");
        assertThat(json).contains("\"parts\":[{\"type\":\"summary\",\"text\":\"Judges Ciparick, Rosenblatt, Graffeo, Read and R.S. Smith concur with Chief Judge Kaye; Judge G.B. Smith dissents and votes to reverse and order a new trial in a separate opinion.\"},{\"type\":\"action\",\"text\":\"Order affirmed.\"}]");
        assertThat(json).doesNotContain("\"disposition\":{\"text\":\"Accordingly, I dissent.\"");
    }

    @Test
    void html_repo_sample_does_not_infer_empty_writing_from_wrapped_panel_line() {
        var source = new SourceDocumentReader().read(Path.of("../../opinions/coa/2004/2004_01056.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"officialCitation\":\"1 NY3d 614\"");
        assertThat(json).contains("\"opinions\":[{\"kind\":\"opinion_of_the_court\"");
        assertThat(json).doesNotContain("\"author\":\"Kaye And Judges G.B\"");
        assertThat(json).doesNotContain("\"label\":\"Chief Judge Kaye and Judges G.B.\"");
        assertThat(json).contains("Chief Judge Kaye and Judges G.B. Smith, Ciparick, Rosenblatt, Graffeo, Read and R.S. Smith concur.");
        assertThat(json).contains("On review of submissions pursuant to section 500.4 of the Rules of the Court of Appeals (22 NYCRR 500.4), order affirmed in a memorandum.");
        assertThat(json).contains("\"parts\":[{\"type\":\"summary\",\"text\":\"Chief Judge Kaye and Judges G.B. Smith, Ciparick, Rosenblatt, Graffeo, Read and R.S. Smith concur.\"},{\"type\":\"action\",\"text\":\"On review of submissions pursuant to section 500.4 of the Rules of the Court of Appeals (22 NYCRR 500.4), order affirmed in a memorandum.\"}]");
        assertThat(json).contains("\"hasSeparateOpinions\":false");
    }

    @Test
    void html_repo_sample_does_not_create_nested_document_panel_from_small_caps_citation() {
        var source = new SourceDocumentReader().read(Path.of("../../opinions/coa/2026/2026_01588.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"caseId\":\"2026_01588\"");
        assertThat(json).contains("\"label\":\"WILSON, Chief Judge (dissenting)\"");
        assertThat(json).doesNotContain("\"kind\":\"mixed\"");
        assertThat(json).doesNotContain("\"author\":\"Univ Of Chicago L Rev 263\"");
    }

    @Test
    void html_repo_sample_emits_structured_memorandum_for_colon_style_banner() {
        var source = new SourceDocumentReader().read(Path.of("../../opinions/coa/2026/2026_01445.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"caseId\":\"2026_01445\"");
        assertThat(json).contains("\"opinions\":[{\"kind\":\"majority\"");
        assertThat(json).contains("\"text\":\"MEMORANDUM:\"");
        assertThat(json).contains("\"text\":\"The order of the Appellate Division should be affirmed.\"");
        assertThat(json).contains("\"opinions\":\"high_confidence\"");
        assertThat(json).doesNotContain("\"opinionFallbackReasons\":[\"no_structured_opinion_blocks_detected\"");
    }

    @Test
    void html_repo_sample_keeps_per_curiam_majority_author_null() {
        var source = new SourceDocumentReader().read(Path.of("../../opinions/coa/2005/2005_09811.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"caseId\":\"2005_09811\"");
        assertThat(json).contains("\"author\":null");
        assertThat(json).contains("\"authorStatus\":\"anonymous\"");
        assertThat(json).doesNotContain("\"kind\":\"per_curiam\"");
    }

    @Test
    void html_repo_sample_uses_header_author_for_anonymous_opinion_of_the_court_majority() {
        var source = new SourceDocumentReader().read(Path.of("../../opinions/coa/2018/2018_03306.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"caseId\":\"2018_03306\"");
        assertThat(json).contains("\"author\":\"Wilson\"");
        assertThat(json).contains("\"authorStatus\":\"named\"");
        assertThat(json).contains("\"label\":\"Wilson, J.\"");
    }

    @Test
    void html_repo_sample_keeps_anonymous_single_writing_memorandum_author_null() {
        var source = new SourceDocumentReader().read(Path.of("../../opinions/coa/2011/2011_01362.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"caseId\":\"2011_01362\"");
        assertThat(json).contains("\"author\":null");
        assertThat(json).contains("\"authorStatus\":\"unknown\"");
        assertThat(json).contains("\"text\":\" OPINION OF THE COURT\"");
        assertThat(json).contains("\"text\":\"Memorandum. \"");
    }

}
