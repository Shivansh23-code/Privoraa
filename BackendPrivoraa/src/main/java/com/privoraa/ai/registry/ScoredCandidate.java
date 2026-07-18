package com.privoraa.ai.registry;

public record ScoredCandidate(ModelDescriptor descriptor, int score) implements Comparable<ScoredCandidate> {
    @Override
    public int compareTo(ScoredCandidate other) {
        int cmp = Integer.compare(other.score, this.score);
        if (cmp != 0) return cmp;
        return this.descriptor().displayName().compareToIgnoreCase(other.descriptor().displayName());
    }
}
