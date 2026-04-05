export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      asaas_webhooks: {
        Row: {
          created_at: string
          event: string
          id: string
          payload: Json
          processed: boolean
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          payload?: Json
          processed?: boolean
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          payload?: Json
          processed?: boolean
        }
        Relationships: []
      }
      blog_posts_ai: {
        Row: {
          category: string
          city_slug: string | null
          content_md: string
          content_md_en: string | null
          created_at: string
          cta: string | null
          cta_en: string | null
          excerpt: string
          excerpt_en: string | null
          faq: Json | null
          faq_en: Json | null
          id: string
          image_alt_en: string | null
          image_alt_pt: string | null
          image_prompt: string | null
          image_source: string | null
          image_url: string | null
          internal_links: Json | null
          keywords: string[] | null
          meta_description: string
          meta_description_en: string | null
          meta_title: string
          meta_title_en: string | null
          published_at: string | null
          read_time: string
          service_slug: string | null
          slug: string
          status: string
          tag: string
          title: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          city_slug?: string | null
          content_md?: string
          content_md_en?: string | null
          created_at?: string
          cta?: string | null
          cta_en?: string | null
          excerpt?: string
          excerpt_en?: string | null
          faq?: Json | null
          faq_en?: Json | null
          id?: string
          image_alt_en?: string | null
          image_alt_pt?: string | null
          image_prompt?: string | null
          image_source?: string | null
          image_url?: string | null
          internal_links?: Json | null
          keywords?: string[] | null
          meta_description?: string
          meta_description_en?: string | null
          meta_title?: string
          meta_title_en?: string | null
          published_at?: string | null
          read_time?: string
          service_slug?: string | null
          slug: string
          status?: string
          tag?: string
          title: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          city_slug?: string | null
          content_md?: string
          content_md_en?: string | null
          created_at?: string
          cta?: string | null
          cta_en?: string | null
          excerpt?: string
          excerpt_en?: string | null
          faq?: Json | null
          faq_en?: Json | null
          id?: string
          image_alt_en?: string | null
          image_alt_pt?: string | null
          image_prompt?: string | null
          image_source?: string | null
          image_url?: string | null
          internal_links?: Json | null
          keywords?: string[] | null
          meta_description?: string
          meta_description_en?: string | null
          meta_title?: string
          meta_title_en?: string | null
          published_at?: string | null
          read_time?: string
          service_slug?: string | null
          slug?: string
          status?: string
          tag?: string
          title?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      budget_leads: {
        Row: {
          city: string | null
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          observations: string | null
          phone: string | null
        }
        Insert: {
          city?: string | null
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          observations?: string | null
          phone?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          observations?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      cep_cache: {
        Row: {
          cep: string
          created_at: string
          data: Json
        }
        Insert: {
          cep: string
          created_at?: string
          data: Json
        }
        Update: {
          cep?: string
          created_at?: string
          data?: Json
        }
        Relationships: []
      }
      certificate_config: {
        Row: {
          auto_sign_enabled: boolean
          certificate_hash: string
          certificate_storage_path: string
          created_at: string
          id: string
          issuer: string | null
          last_used_at: string | null
          serial_number: string | null
          status: string
          subject: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          auto_sign_enabled?: boolean
          certificate_hash: string
          certificate_storage_path: string
          created_at?: string
          id?: string
          issuer?: string | null
          last_used_at?: string | null
          serial_number?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          auto_sign_enabled?: boolean
          certificate_hash?: string
          certificate_storage_path?: string
          created_at?: string
          id?: string
          issuer?: string | null
          last_used_at?: string | null
          serial_number?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      cipa_cycles: {
        Row: {
          created_at: string
          duration_days: number | null
          duration_label: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_current: boolean
          note: string | null
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_days?: number | null
          duration_label?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_current?: boolean
          note?: string | null
          started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_days?: number | null
          duration_label?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_current?: boolean
          note?: string | null
          started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cipa_locations: {
        Row: {
          accuracy: number | null
          captured_at: string
          created_at: string
          device_name: string
          id: string
          is_priority: boolean
          latitude: number
          longitude: number
          person_label: string
          priority_order: number | null
        }
        Insert: {
          accuracy?: number | null
          captured_at?: string
          created_at?: string
          device_name?: string
          id?: string
          is_priority?: boolean
          latitude: number
          longitude: number
          person_label?: string
          priority_order?: number | null
        }
        Update: {
          accuracy?: number | null
          captured_at?: string
          created_at?: string
          device_name?: string
          id?: string
          is_priority?: boolean
          latitude?: number
          longitude?: number
          person_label?: string
          priority_order?: number | null
        }
        Relationships: []
      }
      cipa_stress_daily_stats: {
        Row: {
          cooldown_efficiency_score: number | null
          created_at: string
          critical_exposure_minutes: number | null
          daily_conflict_risk: number | null
          day_key: string
          fight_events_count: number | null
          id: string
          max_value: number | null
          min_value: number | null
          near_fight_events_count: number | null
          rapid_escalation_count: number | null
          updated_at: string
          weighted_average: number | null
        }
        Insert: {
          cooldown_efficiency_score?: number | null
          created_at?: string
          critical_exposure_minutes?: number | null
          daily_conflict_risk?: number | null
          day_key: string
          fight_events_count?: number | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          near_fight_events_count?: number | null
          rapid_escalation_count?: number | null
          updated_at?: string
          weighted_average?: number | null
        }
        Update: {
          cooldown_efficiency_score?: number | null
          created_at?: string
          critical_exposure_minutes?: number | null
          daily_conflict_risk?: number | null
          day_key?: string
          fight_events_count?: number | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          near_fight_events_count?: number | null
          rapid_escalation_count?: number | null
          updated_at?: string
          weighted_average?: number | null
        }
        Relationships: []
      }
      cipa_stress_logs: {
        Row: {
          created_at: string
          day_key: string
          delta_from_previous: number | null
          id: string
          minutes_since_previous: number | null
          session_id: string | null
          source: string
          value: number
        }
        Insert: {
          created_at?: string
          day_key?: string
          delta_from_previous?: number | null
          id?: string
          minutes_since_previous?: number | null
          session_id?: string | null
          source?: string
          value: number
        }
        Update: {
          created_at?: string
          day_key?: string
          delta_from_previous?: number | null
          id?: string
          minutes_since_previous?: number | null
          session_id?: string | null
          source?: string
          value?: number
        }
        Relationships: []
      }
      cipa_stress_monthly_stats: {
        Row: {
          average_cooldown_time: number | null
          created_at: string
          fight_events: number | null
          high_risk_days: number | null
          id: string
          max_peak: number | null
          month_key: string
          month_over_month_variation: number | null
          monthly_average: number | null
          monthly_stability_score: number | null
          near_fight_events: number | null
          stable_days_percent: number | null
          updated_at: string
        }
        Insert: {
          average_cooldown_time?: number | null
          created_at?: string
          fight_events?: number | null
          high_risk_days?: number | null
          id?: string
          max_peak?: number | null
          month_key: string
          month_over_month_variation?: number | null
          monthly_average?: number | null
          monthly_stability_score?: number | null
          near_fight_events?: number | null
          stable_days_percent?: number | null
          updated_at?: string
        }
        Update: {
          average_cooldown_time?: number | null
          created_at?: string
          fight_events?: number | null
          high_risk_days?: number | null
          id?: string
          max_peak?: number | null
          month_key?: string
          month_over_month_variation?: number | null
          monthly_average?: number | null
          monthly_stability_score?: number | null
          near_fight_events?: number | null
          stable_days_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cipa_voice_daily_stats: {
        Row: {
          anger_spikes_count: number | null
          average_tension_score: number | null
          cooldown_voice_recovery_score: number | null
          created_at: string
          day_key: string
          id: string
          peak_tension_score: number | null
          sustained_high_tension_minutes: number | null
          updated_at: string
        }
        Insert: {
          anger_spikes_count?: number | null
          average_tension_score?: number | null
          cooldown_voice_recovery_score?: number | null
          created_at?: string
          day_key: string
          id?: string
          peak_tension_score?: number | null
          sustained_high_tension_minutes?: number | null
          updated_at?: string
        }
        Update: {
          anger_spikes_count?: number | null
          average_tension_score?: number | null
          cooldown_voice_recovery_score?: number | null
          created_at?: string
          day_key?: string
          id?: string
          peak_tension_score?: number | null
          sustained_high_tension_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      client_events: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          event_type: string
          id: string
          related_id: string | null
          related_table: string | null
          title: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          event_type: string
          id?: string
          related_id?: string | null
          related_table?: string | null
          title: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          event_type?: string
          id?: string
          related_id?: string | null
          related_table?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_blocks: {
        Row: {
          active: boolean
          block_type: string
          created_at: string
          default_data: Json | null
          id: string
          is_global: boolean
          label: string
          page_id: string | null
          sort_order: number | null
          updated_at: string
          variant: string | null
        }
        Insert: {
          active?: boolean
          block_type: string
          created_at?: string
          default_data?: Json | null
          id?: string
          is_global?: boolean
          label: string
          page_id?: string | null
          sort_order?: number | null
          updated_at?: string
          variant?: string | null
        }
        Update: {
          active?: boolean
          block_type?: string
          created_at?: string
          default_data?: Json | null
          id?: string
          is_global?: boolean
          label?: string
          page_id?: string | null
          sort_order?: number | null
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_blocks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "cms_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          benefits_data: Json | null
          blocks_order: Json | null
          calculator_config: Json | null
          canonical_url: string | null
          compliance_data: Json | null
          created_at: string
          cta_data: Json | null
          faq_data: Json | null
          hero_data: Json | null
          id: string
          legacy_component: string | null
          meta_description: string | null
          meta_title: string | null
          niche_data: Json | null
          noindex: boolean
          og_image: string | null
          page_type: string
          pain_data: Json | null
          pricing_config: Json | null
          proof_data: Json | null
          published_at: string | null
          related_segments: string[] | null
          related_services: string[] | null
          scope_data: Json | null
          sitemap_changefreq: string | null
          sitemap_priority: string | null
          slug: string
          solution_data: Json | null
          status: string
          template: string
          title: string
          updated_at: string
        }
        Insert: {
          benefits_data?: Json | null
          blocks_order?: Json | null
          calculator_config?: Json | null
          canonical_url?: string | null
          compliance_data?: Json | null
          created_at?: string
          cta_data?: Json | null
          faq_data?: Json | null
          hero_data?: Json | null
          id?: string
          legacy_component?: string | null
          meta_description?: string | null
          meta_title?: string | null
          niche_data?: Json | null
          noindex?: boolean
          og_image?: string | null
          page_type?: string
          pain_data?: Json | null
          pricing_config?: Json | null
          proof_data?: Json | null
          published_at?: string | null
          related_segments?: string[] | null
          related_services?: string[] | null
          scope_data?: Json | null
          sitemap_changefreq?: string | null
          sitemap_priority?: string | null
          slug: string
          solution_data?: Json | null
          status?: string
          template?: string
          title: string
          updated_at?: string
        }
        Update: {
          benefits_data?: Json | null
          blocks_order?: Json | null
          calculator_config?: Json | null
          canonical_url?: string | null
          compliance_data?: Json | null
          created_at?: string
          cta_data?: Json | null
          faq_data?: Json | null
          hero_data?: Json | null
          id?: string
          legacy_component?: string | null
          meta_description?: string | null
          meta_title?: string | null
          niche_data?: Json | null
          noindex?: boolean
          og_image?: string | null
          page_type?: string
          pain_data?: Json | null
          pricing_config?: Json | null
          proof_data?: Json | null
          published_at?: string | null
          related_segments?: string[] | null
          related_services?: string[] | null
          scope_data?: Json | null
          sitemap_changefreq?: string | null
          sitemap_priority?: string | null
          slug?: string
          solution_data?: Json | null
          status?: string
          template?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_pricing_rules: {
        Row: {
          active: boolean
          base_price: number
          created_at: string
          criticality_high: number
          criticality_low: number
          criticality_medium: number
          id: string
          min_value: number | null
          os_type: string
          progressive_discount: Json | null
          resource_type: string
          sla_24h_multiplier: number
          sla_standard_multiplier: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          created_at?: string
          criticality_high?: number
          criticality_low?: number
          criticality_medium?: number
          id?: string
          min_value?: number | null
          os_type?: string
          progressive_discount?: Json | null
          resource_type: string
          sla_24h_multiplier?: number
          sla_standard_multiplier?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          created_at?: string
          criticality_high?: number
          criticality_low?: number
          criticality_medium?: number
          id?: string
          min_value?: number | null
          os_type?: string
          progressive_discount?: Json | null
          resource_type?: string
          sla_24h_multiplier?: number
          sla_standard_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      cms_redirects: {
        Row: {
          active: boolean
          created_at: string
          from_slug: string
          id: string
          to_slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          from_slug: string
          id?: string
          to_slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          from_slug?: string
          id?: string
          to_slug?: string
        }
        Relationships: []
      }
      cnpj_cache: {
        Row: {
          cnpj: string
          created_at: string
          data: Json
        }
        Insert: {
          cnpj: string
          created_at?: string
          data: Json
        }
        Update: {
          cnpj?: string
          created_at?: string
          data?: Json
        }
        Relationships: []
      }
      contract_equipment: {
        Row: {
          computer_model: string
          contract_id: string | null
          cpu: string
          cpu_generation: string
          created_at: string
          id: string
          keyboard_model: string
          monitor_brand: string
          monitor_size: string
          monthly_total: number
          mouse_model: string
          network: string
          quantity: number
          ram: string
          ssd: string
          unit_price: number
        }
        Insert: {
          computer_model?: string
          contract_id?: string | null
          cpu: string
          cpu_generation: string
          created_at?: string
          id?: string
          keyboard_model?: string
          monitor_brand?: string
          monitor_size?: string
          monthly_total: number
          mouse_model?: string
          network?: string
          quantity: number
          ram?: string
          ssd?: string
          unit_price: number
        }
        Update: {
          computer_model?: string
          contract_id?: string | null
          cpu?: string
          cpu_generation?: string
          created_at?: string
          id?: string
          keyboard_model?: string
          monitor_brand?: string
          monitor_size?: string
          monthly_total?: number
          mouse_model?: string
          network?: string
          quantity?: number
          ram?: string
          ssd?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_equipment_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contract_hash: string | null
          contract_id: string
          id: string
          ip_address: string | null
          signature_data: string
          signed_at: string
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          contract_hash?: string | null
          contract_id: string
          id?: string
          ip_address?: string | null
          signature_data: string
          signed_at?: string
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          contract_hash?: string | null
          contract_id?: string
          id?: string
          ip_address?: string | null
          signature_data?: string
          signed_at?: string
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          ativo: boolean
          created_at: string
          editavel: boolean
          id: string
          nome: string
          template_text: string
          tipo: string
          updated_at: string
          versao: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          editavel?: boolean
          id: string
          nome: string
          template_text: string
          tipo?: string
          updated_at?: string
          versao?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          editavel?: boolean
          id?: string
          nome?: string
          template_text?: string
          tipo?: string
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          accepted_minimum_term: boolean | null
          activated_at: string | null
          client_ip: string | null
          contract_hash: string | null
          contract_pdf_path: string | null
          contract_text: string | null
          contract_type: string | null
          created_at: string
          customer_id: string | null
          id: string
          monthly_value: number | null
          quote_id: string | null
          service_status: string
          signed: boolean | null
          signed_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_minimum_term?: boolean | null
          activated_at?: string | null
          client_ip?: string | null
          contract_hash?: string | null
          contract_pdf_path?: string | null
          contract_text?: string | null
          contract_type?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          monthly_value?: number | null
          quote_id?: string | null
          service_status?: string
          signed?: boolean | null
          signed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_minimum_term?: boolean | null
          activated_at?: string | null
          client_ip?: string | null
          contract_hash?: string | null
          contract_pdf_path?: string | null
          contract_text?: string | null
          contract_type?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          monthly_value?: number | null
          quote_id?: string | null
          service_status?: string
          signed?: boolean | null
          signed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj_ou_cpf: string
          created_at: string
          email: string
          endereco: string | null
          id: string
          nome_fantasia: string | null
          razao_social: string
          responsavel: string
          status_cliente: string
          suspended_at: string | null
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj_ou_cpf: string
          created_at?: string
          email: string
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          responsavel: string
          status_cliente?: string
          suspended_at?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj_ou_cpf?: string
          created_at?: string
          email?: string
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          responsavel?: string
          status_cliente?: string
          suspended_at?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      emotion_events: {
        Row: {
          conflict_flag: boolean
          created_at: string
          device_id: string | null
          device_type: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          peak_level: number
          relationship_id: string | null
          source_type: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          conflict_flag?: boolean
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          peak_level?: number
          relationship_id?: string | null
          source_type?: string | null
          started_at?: string
          user_id?: string
        }
        Update: {
          conflict_flag?: boolean
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          peak_level?: number
          relationship_id?: string | null
          source_type?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emotion_logs: {
        Row: {
          bio_source: string | null
          created_at: string
          data_mode: string | null
          device_id: string | null
          device_type: string | null
          heart_rate: number | null
          hrv: number | null
          id: string
          manual_level: number
          partner_user_id: string | null
          relationship_id: string | null
          session_id: string | null
          sleep_score: number | null
          source_type: string | null
          status_label: string
          user_id: string
        }
        Insert: {
          bio_source?: string | null
          created_at?: string
          data_mode?: string | null
          device_id?: string | null
          device_type?: string | null
          heart_rate?: number | null
          hrv?: number | null
          id?: string
          manual_level: number
          partner_user_id?: string | null
          relationship_id?: string | null
          session_id?: string | null
          sleep_score?: number | null
          source_type?: string | null
          status_label?: string
          user_id?: string
        }
        Update: {
          bio_source?: string | null
          created_at?: string
          data_mode?: string | null
          device_id?: string | null
          device_type?: string | null
          heart_rate?: number | null
          hrv?: number | null
          id?: string
          manual_level?: number
          partner_user_id?: string | null
          relationship_id?: string | null
          session_id?: string | null
          sleep_score?: number | null
          source_type?: string | null
          status_label?: string
          user_id?: string
        }
        Relationships: []
      }
      emotion_statistics: {
        Row: {
          average_score: number | null
          conflict_events: number | null
          cooldown_avg_minutes: number | null
          created_at: string
          critical_events: number | null
          id: string
          max_score: number | null
          month_key: string
          stability_score: number | null
          total_readings: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_score?: number | null
          conflict_events?: number | null
          cooldown_avg_minutes?: number | null
          created_at?: string
          critical_events?: number | null
          id?: string
          max_score?: number | null
          month_key: string
          stability_score?: number | null
          total_readings?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          average_score?: number | null
          conflict_events?: number | null
          cooldown_avg_minutes?: number | null
          created_at?: string
          critical_events?: number | null
          id?: string
          max_score?: number | null
          month_key?: string
          stability_score?: number | null
          total_readings?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emotion_triggers: {
        Row: {
          avg_intensity: number | null
          created_at: string
          frequency: number | null
          id: string
          last_seen: string | null
          trigger_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_intensity?: number | null
          created_at?: string
          frequency?: number | null
          id?: string
          last_seen?: string | null
          trigger_name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          avg_intensity?: number | null
          created_at?: string
          frequency?: number | null
          id?: string
          last_seen?: string | null
          trigger_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fiscal_documents: {
        Row: {
          access_key: string | null
          amount: number
          asaas_invoice_id: string | null
          contract_id: string | null
          created_at: string
          customer_id: string
          document_number: string | null
          document_type: string
          file_url: string | null
          id: string
          invoice_series: string | null
          issue_date: string
          notes: string | null
          payment_id: string | null
          raw_payload: Json | null
          service_reference: string | null
          status: string
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          amount?: number
          asaas_invoice_id?: string | null
          contract_id?: string | null
          created_at?: string
          customer_id: string
          document_number?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          invoice_series?: string | null
          issue_date?: string
          notes?: string | null
          payment_id?: string | null
          raw_payload?: Json | null
          service_reference?: string | null
          status?: string
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          amount?: number
          asaas_invoice_id?: string | null
          contract_id?: string | null
          created_at?: string
          customer_id?: string
          document_number?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          invoice_series?: string | null
          issue_date?: string
          notes?: string | null
          payment_id?: string | null
          raw_payload?: Json | null
          service_reference?: string | null
          status?: string
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          integration_name: string
          operation_name: string
          request_payload: Json | null
          response_payload: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          integration_name: string
          operation_name: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          integration_name?: string
          operation_name?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      intervention_logs: {
        Row: {
          accepted: boolean | null
          created_at: string
          effectiveness_score: number | null
          id: string
          intervention_text: string | null
          intervention_type: string
          notes: string | null
          relationship_id: string | null
          trigger_event_id: string | null
          user_id: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string
          effectiveness_score?: number | null
          id?: string
          intervention_text?: string | null
          intervention_type?: string
          notes?: string | null
          relationship_id?: string | null
          trigger_event_id?: string | null
          user_id?: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string
          effectiveness_score?: number | null
          id?: string
          intervention_text?: string | null
          intervention_type?: string
          notes?: string | null
          relationship_id?: string | null
          trigger_event_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_logs_trigger_event_id_fkey"
            columns: ["trigger_event_id"]
            isOneToOne: false
            referencedRelation: "emotion_events"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_files: {
        Row: {
          created_at: string
          file_url: string
          filename: string | null
          id: string
          invoice_id: string
          mime_type: string | null
          type: string
        }
        Insert: {
          created_at?: string
          file_url: string
          filename?: string | null
          id?: string
          invoice_id: string
          mime_type?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          file_url?: string
          filename?: string | null
          id?: string
          invoice_id?: string
          mime_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_files_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          lead_status: string | null
          message: string | null
          name: string
          phone: string | null
          service_interest: string | null
          source_page: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          lead_status?: string | null
          message?: string | null
          name: string
          phone?: string | null
          service_interest?: string | null
          source_page?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          lead_status?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          service_interest?: string | null
          source_page?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      logs_sistema: {
        Row: {
          created_at: string
          id: string
          mensagem: string
          payload: Json | null
          status: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem: string
          payload?: Json | null
          status?: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string
          payload?: Json | null
          status?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      network_diagnostics: {
        Row: {
          average_pc_age: string | null
          computers_current: number | null
          created_at: string
          has_backup: boolean | null
          has_server: boolean | null
          id: string
          maintenance_frequency: string | null
          quote_id: string | null
        }
        Insert: {
          average_pc_age?: string | null
          computers_current?: number | null
          created_at?: string
          has_backup?: boolean | null
          has_server?: boolean | null
          id?: string
          maintenance_frequency?: string | null
          quote_id?: string | null
        }
        Update: {
          average_pc_age?: string | null
          computers_current?: number | null
          created_at?: string
          has_backup?: boolean | null
          has_server?: boolean | null
          id?: string
          maintenance_frequency?: string | null
          quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_diagnostics_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          billing_type: string | null
          created_at: string
          due_date: string | null
          id: string
          payment_method: string | null
          payment_status: string | null
          quote_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          quote_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          quote_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_intelligence: {
        Row: {
          analysis_data: Json | null
          analysis_type: string
          applied: boolean | null
          applied_at: string | null
          auto_applicable: boolean | null
          confidence: number | null
          created_at: string
          finished_at: string | null
          high_priority: number | null
          id: string
          impact_score: number | null
          low_priority: number | null
          medium_priority: number | null
          prompt_type: string | null
          prompts: Json | null
          rejected_at: string | null
          source: string | null
          status: string
          summary: string | null
          total_prompts: number | null
          triggered_by: string | null
        }
        Insert: {
          analysis_data?: Json | null
          analysis_type?: string
          applied?: boolean | null
          applied_at?: string | null
          auto_applicable?: boolean | null
          confidence?: number | null
          created_at?: string
          finished_at?: string | null
          high_priority?: number | null
          id?: string
          impact_score?: number | null
          low_priority?: number | null
          medium_priority?: number | null
          prompt_type?: string | null
          prompts?: Json | null
          rejected_at?: string | null
          source?: string | null
          status?: string
          summary?: string | null
          total_prompts?: number | null
          triggered_by?: string | null
        }
        Update: {
          analysis_data?: Json | null
          analysis_type?: string
          applied?: boolean | null
          applied_at?: string | null
          auto_applicable?: boolean | null
          confidence?: number | null
          created_at?: string
          finished_at?: string | null
          high_priority?: number | null
          id?: string
          impact_score?: number | null
          low_priority?: number | null
          medium_priority?: number | null
          prompt_type?: string | null
          prompts?: Json | null
          rejected_at?: string | null
          source?: string | null
          status?: string
          summary?: string | null
          total_prompts?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          computers_qty: number
          contract_months: number
          created_at: string
          customer_id: string | null
          id: string
          lead_id: string | null
          plan: string
          quote_id: string | null
          status: string
          total_value: number
          unit_price: number
          updated_at: string
          valid_until: string
          version: number
        }
        Insert: {
          computers_qty?: number
          contract_months?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          plan?: string
          quote_id?: string | null
          status?: string
          total_value?: number
          unit_price?: number
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Update: {
          computers_qty?: number
          contract_months?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          plan?: string
          quote_id?: string | null
          status?: string
          total_value?: number
          unit_price?: number
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          computers_qty: number | null
          created_at: string
          id: string
          lead_id: string | null
          monthly_value: number | null
          needs_backup: boolean | null
          needs_remote_access: boolean | null
          needs_server_migration: boolean | null
          selected_plan: string | null
          status: string | null
          users_qty: number | null
        }
        Insert: {
          computers_qty?: number | null
          created_at?: string
          id?: string
          lead_id?: string | null
          monthly_value?: number | null
          needs_backup?: boolean | null
          needs_remote_access?: boolean | null
          needs_server_migration?: boolean | null
          selected_plan?: string | null
          status?: string | null
          users_qty?: number | null
        }
        Update: {
          computers_qty?: number | null
          created_at?: string
          id?: string
          lead_id?: string | null
          monthly_value?: number | null
          needs_backup?: boolean | null
          needs_remote_access?: boolean | null
          needs_server_migration?: boolean | null
          selected_plan?: string | null
          status?: string | null
          users_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "budget_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_members: {
        Row: {
          consent_at: string | null
          consent_given: boolean
          created_at: string
          id: string
          relationship_id: string
          role: string
          user_id: string
        }
        Insert: {
          consent_at?: string | null
          consent_given?: boolean
          created_at?: string
          id?: string
          relationship_id: string
          role?: string
          user_id?: string
        }
        Update: {
          consent_at?: string | null
          consent_given?: boolean
          created_at?: string
          id?: string
          relationship_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_members_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          partner_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          partner_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          partner_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      revenue_intelligence: {
        Row: {
          actual_value: number | null
          analysis_summary: string | null
          company_size: string | null
          conversion_probability: number | null
          converted: boolean | null
          created_at: string
          decision_stage: string | null
          discount_suggested: number | null
          id: string
          lead_id: string | null
          lead_value_estimate: number | null
          machines_qty: number | null
          pain_point: string | null
          price_suggested: number | null
          quote_id: string | null
          sector: string | null
          service_type: string | null
          strategy: string | null
          updated_at: string
          urgency_level: string | null
        }
        Insert: {
          actual_value?: number | null
          analysis_summary?: string | null
          company_size?: string | null
          conversion_probability?: number | null
          converted?: boolean | null
          created_at?: string
          decision_stage?: string | null
          discount_suggested?: number | null
          id?: string
          lead_id?: string | null
          lead_value_estimate?: number | null
          machines_qty?: number | null
          pain_point?: string | null
          price_suggested?: number | null
          quote_id?: string | null
          sector?: string | null
          service_type?: string | null
          strategy?: string | null
          updated_at?: string
          urgency_level?: string | null
        }
        Update: {
          actual_value?: number | null
          analysis_summary?: string | null
          company_size?: string | null
          conversion_probability?: number | null
          converted?: boolean | null
          created_at?: string
          decision_stage?: string | null
          discount_suggested?: number | null
          id?: string
          lead_id?: string | null
          lead_value_estimate?: number | null
          machines_qty?: number | null
          pain_point?: string | null
          price_suggested?: number | null
          quote_id?: string | null
          sector?: string | null
          service_type?: string | null
          strategy?: string | null
          updated_at?: string
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_intelligence_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_intelligence_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string
          event_type: string
          id: string
          ip_address: string | null
          payload: Json | null
          request_id: string | null
          route: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description: string
          event_type: string
          id?: string
          ip_address?: string | null
          payload?: Json | null
          request_id?: string | null
          route?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          payload?: Json | null
          request_id?: string | null
          route?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          id: string
          priority: string
          quote_id: string | null
          service_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          priority?: string
          quote_id?: string | null
          service_type?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          priority?: string
          quote_id?: string | null
          service_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_logs: {
        Row: {
          certificate_id: string | null
          contract_id: string | null
          created_at: string
          document_hash: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          original_pdf_path: string | null
          signed_at: string
          signed_pdf_path: string | null
          status: string
          user_agent: string | null
          validation_result: string | null
        }
        Insert: {
          certificate_id?: string | null
          contract_id?: string | null
          created_at?: string
          document_hash?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          original_pdf_path?: string | null
          signed_at?: string
          signed_pdf_path?: string | null
          status?: string
          user_agent?: string | null
          validation_result?: string | null
        }
        Update: {
          certificate_id?: string | null
          contract_id?: string | null
          created_at?: string
          document_hash?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          original_pdf_path?: string | null
          signed_at?: string
          signed_pdf_path?: string | null
          status?: string
          user_agent?: string | null
          validation_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_logs_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificate_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      test_alert_config: {
        Row: {
          channel: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          channel: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_run_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          run_id: string
          spec_name: string | null
          stack_trace: string | null
          status: string | null
          test_name: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          run_id: string
          spec_name?: string | null
          stack_trace?: string | null
          status?: string | null
          test_name?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          run_id?: string
          spec_name?: string | null
          stack_trace?: string | null
          status?: string | null
          test_name?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_runs: {
        Row: {
          base_url: string | null
          browser: string | null
          build_ref: string | null
          client_id: string | null
          client_name: string | null
          completed_specs: number | null
          completed_tests: number | null
          created_at: string
          current_spec: string | null
          current_test: string | null
          current_url: string | null
          duration_ms: number | null
          environment: string | null
          error_message: string | null
          error_summary: string | null
          execution_engine: string | null
          failed_tests: number | null
          finished_at: string | null
          github_run_id: string | null
          github_run_url: string | null
          id: string
          ingest_token: string | null
          last_event_at: string | null
          logs: Json | null
          passed_tests: number | null
          plan_type: string | null
          progress_percent: number | null
          report_url: string | null
          results: Json | null
          screenshot_urls: string[] | null
          skipped_tests: number | null
          started_at: string | null
          status: string
          suite: string
          test_type: string
          total_specs: number | null
          total_tests: number | null
          triggered_by: string | null
          updated_at: string
          video_urls: string[] | null
          viewport: string | null
        }
        Insert: {
          base_url?: string | null
          browser?: string | null
          build_ref?: string | null
          client_id?: string | null
          client_name?: string | null
          completed_specs?: number | null
          completed_tests?: number | null
          created_at?: string
          current_spec?: string | null
          current_test?: string | null
          current_url?: string | null
          duration_ms?: number | null
          environment?: string | null
          error_message?: string | null
          error_summary?: string | null
          execution_engine?: string | null
          failed_tests?: number | null
          finished_at?: string | null
          github_run_id?: string | null
          github_run_url?: string | null
          id?: string
          ingest_token?: string | null
          last_event_at?: string | null
          logs?: Json | null
          passed_tests?: number | null
          plan_type?: string | null
          progress_percent?: number | null
          report_url?: string | null
          results?: Json | null
          screenshot_urls?: string[] | null
          skipped_tests?: number | null
          started_at?: string | null
          status?: string
          suite: string
          test_type?: string
          total_specs?: number | null
          total_tests?: number | null
          triggered_by?: string | null
          updated_at?: string
          video_urls?: string[] | null
          viewport?: string | null
        }
        Update: {
          base_url?: string | null
          browser?: string | null
          build_ref?: string | null
          client_id?: string | null
          client_name?: string | null
          completed_specs?: number | null
          completed_tests?: number | null
          created_at?: string
          current_spec?: string | null
          current_test?: string | null
          current_url?: string | null
          duration_ms?: number | null
          environment?: string | null
          error_message?: string | null
          error_summary?: string | null
          execution_engine?: string | null
          failed_tests?: number | null
          finished_at?: string | null
          github_run_id?: string | null
          github_run_url?: string | null
          id?: string
          ingest_token?: string | null
          last_event_at?: string | null
          logs?: Json | null
          passed_tests?: number | null
          plan_type?: string | null
          progress_percent?: number | null
          report_url?: string | null
          results?: Json | null
          screenshot_urls?: string[] | null
          skipped_tests?: number | null
          started_at?: string | null
          status?: string
          suite?: string
          test_type?: string
          total_specs?: number | null
          total_tests?: number | null
          triggered_by?: string | null
          updated_at?: string
          video_urls?: string[] | null
          viewport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          consistency_score: number | null
          created_at: string
          current_streak: number
          id: string
          last_entry_date: string | null
          longest_streak: number
          total_days_logged: number
          updated_at: string
          user_id: string
        }
        Insert: {
          consistency_score?: number | null
          created_at?: string
          current_streak?: number
          id?: string
          last_entry_date?: string | null
          longest_streak?: number
          total_days_logged?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          consistency_score?: number | null
          created_at?: string
          current_streak?: number
          id?: string
          last_entry_date?: string | null
          longest_streak?: number
          total_days_logged?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_emotion_logs: {
        Row: {
          anger_probability_estimate: number | null
          confidence_score: number | null
          created_at: string
          day_key: string
          id: string
          pitch_mean: number | null
          pitch_variation: number | null
          session_id: string | null
          source: string
          speech_rate_estimate: number | null
          tension_score: number | null
          voice_energy: number | null
        }
        Insert: {
          anger_probability_estimate?: number | null
          confidence_score?: number | null
          created_at?: string
          day_key?: string
          id?: string
          pitch_mean?: number | null
          pitch_variation?: number | null
          session_id?: string | null
          source?: string
          speech_rate_estimate?: number | null
          tension_score?: number | null
          voice_energy?: number | null
        }
        Update: {
          anger_probability_estimate?: number | null
          confidence_score?: number | null
          created_at?: string
          day_key?: string
          id?: string
          pitch_mean?: number | null
          pitch_variation?: number | null
          session_id?: string | null
          source?: string
          speech_rate_estimate?: number | null
          tension_score?: number | null
          voice_energy?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
