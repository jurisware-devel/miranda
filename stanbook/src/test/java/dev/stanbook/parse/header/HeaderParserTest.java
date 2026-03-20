package dev.stanbook.parse.header;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.stanbook.ir.lowered.Header;
import dev.stanbook.ir.lowered.HeaderItem;
import dev.stanbook.ir.lowered.HeaderItemType;
import dev.stanbook.ir.lowered.PublicationStatus;
import dev.stanbook.ir.section.DocumentSection;
import dev.stanbook.ir.section.SectionType;
import dev.stanbook.ir.source.SourceLine;
import java.util.List;
import org.junit.jupiter.api.Test;

class HeaderParserTest {
    private final HeaderParser parser = new HeaderParser();

    @Test
    void classifies_specific_header_component_types() {
        assertThat(parser.classifyHeaderLine(new SourceLine(1, "People v Smith"))).isEqualTo(HeaderItemType.CASE_NAME);
        assertThat(parser.classifyHeaderLine(new SourceLine(2, "41 NY3d 146 [2006]"))).isEqualTo(HeaderItemType.CITATION);
        assertThat(parser.classifyHeaderLine(new SourceLine(3, "NY Court of Appeals"))).isEqualTo(HeaderItemType.COURT);
        assertThat(parser.classifyHeaderLine(new SourceLine(4, "Corrected June 1, 2006"))).isEqualTo(HeaderItemType.CORRECTED_DATE);
        assertThat(parser.classifyHeaderLine(new SourceLine(5, "Argued January 5, 2006"))).isEqualTo(HeaderItemType.ARGUED_DATE);
        assertThat(parser.classifyHeaderLine(new SourceLine(6, "Decided March 1, 2006"))).isEqualTo(HeaderItemType.DECIDED_DATE);
        assertThat(parser.classifyHeaderLine(new SourceLine(7, "Jane Doe, for appellant."))).isEqualTo(HeaderItemType.COUNSEL);
        assertThat(parser.classifyHeaderLine(new SourceLine(8, "People v Smith, 112 AD3d 114, reversed."))).isEqualTo(HeaderItemType.ACTION);
        assertThat(parser.classifyHeaderLine(new SourceLine(9, "[*1]"))).isEqualTo(HeaderItemType.GARBAGE);
        assertThat(parser.classifyHeaderLine(new SourceLine(10, "APPEARANCES OF COUNSEL"))).isEqualTo(HeaderItemType.APPEARANCES_HEADING);
        assertThat(parser.classifyHeaderLine(new SourceLine(11, "No. 113"))).isEqualTo(HeaderItemType.DOCKET_NUMBER);
        assertThat(parser.classifyHeaderLine(new SourceLine(12, "v"))).isEqualTo(HeaderItemType.CAPTION_V);
        assertThat(
            parser.classifyHeaderLine(new SourceLine(13, "Published by [1]New York State Law Reporting Bureau pursuant to"))
        ).isEqualTo(HeaderItemType.BOILERPLATE);
        assertThat(parser.classifyHeaderLine(new SourceLine(14, "Some unusual header line"))).isEqualTo(HeaderItemType.OTHER);
    }

    @Test
    void parse_preserves_order_and_labels() {
        DocumentSection section = new DocumentSection(
            SectionType.HEADER_BLOCK,
            1,
            6,
            List.of(
                new SourceLine(1, "People v Smith"),
                new SourceLine(2, "2024 NY Slip Op 01234(U)"),
                new SourceLine(3, "NY Court of Appeals"),
                new SourceLine(4, "Argued January 5, 2024"),
                new SourceLine(5, "Decided March 1, 2024"),
                new SourceLine(6, "Jane Doe, for appellant.")
            )
        );

        Header parsed = parser.parse(section);

        assertThat(parsed.items()).extracting(HeaderItem::type)
            .containsExactly(
                HeaderItemType.CASE_NAME,
                HeaderItemType.CITATION,
                HeaderItemType.COURT,
                HeaderItemType.ARGUED_DATE,
                HeaderItemType.DECIDED_DATE,
                HeaderItemType.COUNSEL
            );
        assertThat(parsed.items()).extracting(item -> item.line().lineNumber())
            .containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(parser.inferPublicationStatus(parsed)).isEqualTo(PublicationStatus.SLIP_OP_ONLY);
    }

    @Test
    void publication_status_detects_published_when_official_reporter_present() {
        Header header = new Header(
            List.of(
                new HeaderItem(HeaderItemType.CASE_NAME, new SourceLine(1, "People v Smith")),
                new HeaderItem(HeaderItemType.CITATION, new SourceLine(2, "41 NY3d 146 [2006]")),
                new HeaderItem(HeaderItemType.CITATION, new SourceLine(3, "2006 NY Slip Op 12345(U)"))
            )
        );

        assertThat(parser.inferPublicationStatus(header)).isEqualTo(PublicationStatus.PUBLISHED);
    }

    @Test
    void publication_status_is_unknown_without_citation() {
        Header header = new Header(
            List.of(
                new HeaderItem(HeaderItemType.CASE_NAME, new SourceLine(1, "People v Smith")),
                new HeaderItem(HeaderItemType.OTHER, new SourceLine(2, "Unusual header text"))
            )
        );

        assertThat(parser.inferPublicationStatus(header)).isEqualTo(PublicationStatus.UNKNOWN);
    }

    @Test
    void parse_rejects_non_header_sections() {
        DocumentSection section = new DocumentSection(
            SectionType.OPINION_TEXT,
            1,
            1,
            List.of(new SourceLine(1, "OPINION OF THE COURT"))
        );

        assertThatThrownBy(() -> parser.parse(section))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Expected HEADER_BLOCK section");
    }
}
