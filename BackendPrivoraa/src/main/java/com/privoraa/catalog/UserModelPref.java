package com.privoraa.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A user's chosen active chat model. */
@Entity
@Table(name = "user_model_prefs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserModelPref {

    @Id
    @Column(name = "user_id", length = 36)
    private String userId;

    @Column(name = "active_model", nullable = false, length = 120)
    private String activeModel;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
