package com.privoraa.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearerAuth";

    @Bean
    public OpenAPI privoraaOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Privoraa API")
                        .version("2.0.0")
                        .description("Privacy-first multi-model AI workspace. Proxies OpenRouter behind "
                                + "JWT auth with intent-based model routing, SSE streaming, Redis rate "
                                + "limiting and a RAG pipeline.")
                        .license(new License().name("MIT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER))
                .components(new Components().addSecuritySchemes(BEARER,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
