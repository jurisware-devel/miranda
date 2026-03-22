package dev.stanbook.ir.source;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SourceNotes(
    String caseId,
    HeaderNotes header,
    List<SourceNoteAnomaly> anomalies
) {
    public boolean hasAnomalyCode(String code) {
        return anomalies != null && anomalies.stream().anyMatch(anomaly -> code.equals(anomaly.code()));
    }

    public List<SourceNoteAppearance> appearanceLikeLines() {
        if (header == null || header.appearanceLikeLines() == null) {
            return List.of();
        }
        return header.appearanceLikeLines();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HeaderNotes(
        List<SourceNoteAppearance> appearanceLikeLines
    ) {}
}
