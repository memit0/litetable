CREATE OR REPLACE FUNCTION calculate_priority_score(
  p_tenant_id UUID,
  p_custom_fields JSONB
) RETURNS DECIMAL AS $$
DECLARE
  v_config JSONB;
  v_score DECIMAL := 0;
  v_field_name TEXT;
  v_weight DECIMAL;
  v_field_value DECIMAL;
BEGIN
  -- Get tenant's scoring formula
  SELECT scoring_formula INTO v_config
  FROM priority_configs
  WHERE tenant_id = p_tenant_id AND is_active = true
  LIMIT 1;
  
  -- Iterate through each field in the formula
  FOR v_field_name, v_weight IN 
    SELECT key, value::decimal 
    FROM jsonb_each_text(v_config)
  LOOP
    -- Extract field value from custom_fields (with type coercion)
    v_field_value := COALESCE(
      (p_custom_fields->>v_field_name)::decimal, 
      0
    );
    
    -- Add to total score
    v_score := v_score + (v_field_value * v_weight);
  END LOOP;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_priority_score_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_score := calculate_priority_score(
    NEW.tenant_id,
    NEW.custom_fields
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_priority_score
  BEFORE INSERT OR UPDATE OF custom_fields
  ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_priority_score_trigger();
