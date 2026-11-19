# encoding: UTF-8
require 'json'
require 'digest'

module CJCalculator
  # Read-only snapshots. SketchUp's internal inches never depend on display units.
  class Geometry
    METRE = 0.0254
    MAX_PARTS = 1000
    MAX_ENTITIES = 250_000

    def self.instance?(entity)
      entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
    end

    def self.determinant(transform)
      x, y, z = axes(transform)
      x.dot(y.cross(z)).abs
    end

    def self.axes(transform)
      # Transformation#xaxis/yaxis/zaxis normalize their result in SketchUp.
      [[1,0,0], [0,1,0], [0,0,1]].map { |axis| Geom::Vector3d.new(axis).transform(transform) }
    end

    def initialize(model, options = {})
      @model = model
      @split = options['split'] == true
      @include_hidden = options['include_hidden'] == true
      @visited = 0
      @parts = []
      @skipped = 0
    end

    def visible?(entity)
      return true if @include_hidden
      return false unless entity.visible?
      layer = entity.respond_to?(:layer) ? entity.layer : nil
      return false if layer && !layer.visible?
      folder = layer && layer.respond_to?(:folder) ? layer.folder : nil
      while folder
        return false unless folder.visible?
        folder = folder.folder
      end
      true
    end

    def budget!(depth)
      @visited += 1
      raise 'Слишком большая выборка. Выделите меньше деталей.' if @visited > MAX_ENTITIES || depth > 40
    end

    def name(entity)
      label = entity.respond_to?(:name) ? entity.name.to_s : ''
      label = entity.definition.name.to_s if label.empty? && self.class.instance?(entity)
      label = {'Face' => 'Грань', 'Edge' => 'Ребро', 'Group' => 'Группа', 'ComponentInstance' => 'Компонент'}[entity.typename] || entity.typename if label.empty?
      label[0, 500]
    end

    def labels(entity)
      result = []
      result << { 'source' => 'instance', 'text' => entity.name.to_s[0, 500] } if entity.respond_to?(:name) && !entity.name.to_s.empty?
      if self.class.instance?(entity) && !entity.definition.name.to_s.empty?
        result << { 'source' => 'definition', 'text' => entity.definition.name.to_s[0, 500] }
      end
      tag = entity.respond_to?(:layer) ? entity.layer : nil
      if tag && tag.respond_to?(:name) && !tag.name.to_s.empty? && !['Layer0', 'Untagged', 'Без тега'].include?(tag.name)
        result << { 'source' => 'tag', 'text' => tag.name.to_s[0, 500] }
      end
      if entity.respond_to?(:material) && entity.material
        result << { 'source' => 'material', 'text' => entity.material.display_name.to_s[0, 500] }
      end
      result
    end

    def capture
      selected = @model.selection.to_a.sort_by(&:persistent_id)
      raise 'Выделите группы, компоненты, грани или рёбра в модели и нажмите «Получить выделение».' if selected.empty?
      # Triple-click loose geometry selects both faces and their boundary edges.
      covered = selected.grep(Sketchup::Face).flat_map(&:edges)
      prefix = (@model.active_path || []).map(&:persistent_id)
      parent_labels = (@model.active_path || []).flat_map { |e| labels(e).select { |l| l['source'] == 'tag' } }
      selected.each do |entity|
        next if entity.is_a?(Sketchup::Edge) && covered.include?(entity)
        collect(entity, @model.edit_transform, prefix, 0, parent_labels)
      end
      raise 'В выделении нет доступной геометрии. Проверьте видимость и состав групп.' if @parts.empty?
      revision = Digest::SHA256.hexdigest(JSON.generate(@parts))[0, 20]
      # Model#guid changes on save. Hash the stable path without exposing it.
      model_path = @model.path.to_s.tr('\\', '/').downcase
      model_id = model_path.empty? ? @model.guid : 'skp-' + Digest::SHA256.hexdigest(model_path)
      { 'format' => 'cj-sketchup-selection', 'version' => 1, 'model_id' => model_id,
        'model_name' => (@model.title.empty? ? 'Без названия' : @model.title)[0, 500],
        'revision' => revision, 'parts' => @parts, 'skipped' => @skipped,
        'include_hidden' => @include_hidden, 'split' => @split }
    end

    def collect(entity, parent, path, depth, parent_labels = [])
      budget!(depth)
      unless visible?(entity)
        @skipped += 1
        return
      end
      path = path + [entity.persistent_id]
      if self.class.instance?(entity)
        entities = entity.definition.entities.to_a
        children = entities.select { |e| self.class.instance?(e) }
        loose = entities.any? { |e| e.is_a?(Sketchup::Face) || e.is_a?(Sketchup::Edge) }
        if @split && !children.empty? && !loose
          inherited = parent_labels + labels(entity).select { |l| l['source'] == 'tag' }
          children.sort_by(&:persistent_id).each { |child| collect(child, parent * entity.transformation, path, depth + 1, inherited) }
          return
        end
      elsif !entity.is_a?(Sketchup::Face) && !entity.is_a?(Sketchup::Edge)
        @skipped += 1
        return
      end
      raise 'Не более 1000 деталей за один приём. Сократите выделение.' if @parts.length >= MAX_PARTS
      row = measure(entity, parent, path, depth)
      row['labels'] = (labels(entity) + parent_labels.reverse.map { |l| { 'source' => 'parent_tag', 'text' => l['text'] } }).uniq.first(20)
      @parts << row
    end

    def measure(entity, parent, path, depth)
      instance = self.class.instance?(entity)
      world = instance ? parent * entity.transformation : parent
      items = instance ? entity.definition.entities.to_a : [entity]
      stats = { area: 0.0, edge: 0.0, faces: 0, edges: 0, points: [], hidden: false, children: false }
      scan(items, world, Geom::Transformation.new, stats, depth)
      bounds = Geom::BoundingBox.new
      stats[:points].each { |point| bounds.add(point) }
      dimensions = if bounds.empty?
                     [nil, nil, nil]
                   else
                     axes = self.class.axes(world)
                     [bounds.width * axes[0].length * METRE,
                      bounds.height * axes[1].length * METRE,
                      bounds.depth * axes[2].length * METRE]
                   end
      volume = nil
      # The native instance volume already includes its own transformation.
      if instance && !stats[:children] && !stats[:hidden] && entity.manifold?
        native = entity.volume
        volume = native * self.class.determinant(parent) * METRE**3 if native && native > 0
      end
      material = entity.respond_to?(:material) && entity.material ? entity.material.display_name.to_s[0, 500] : nil
      notes = []
      notes << 'Объём неизвестен: нужна отдельная замкнутая группа или компонент.' if volume.nil?
      notes << 'Составной узел: поверхности вложенных деталей суммируются, включая соприкасающиеся.' if stats[:children]
      notes << 'Скрытая геометрия исключена; объём всего тела не используется.' if stats[:hidden]
      { 'id' => 'p-' + path.join('-'), 'occurrence' => path.join('/'), 'name' => name(entity),
        'kind' => entity.typename, 'material' => material, 'dimensions_m' => dimensions,
        'surface_area_m2' => stats[:faces] > 0 ? stats[:area] * METRE**2 : nil,
        'face_area_m2' => entity.is_a?(Sketchup::Face) ? stats[:area] * METRE**2 : nil,
        'edge_length_m' => stats[:edges] > 0 ? stats[:edge] * METRE : nil,
        'volume_m3' => volume, 'notes' => notes }
    end

    def scan(entities, world, relative, stats, depth)
      entities.each do |entity|
        budget!(depth)
        unless visible?(entity)
          stats[:hidden] = true
          next
        end
        if self.class.instance?(entity)
          stats[:children] = true
          scan(entity.definition.entities.to_a, world * entity.transformation,
               relative * entity.transformation, stats, depth + 1)
        elsif entity.is_a?(Sketchup::Face)
          stats[:area] += entity.area(world)
          stats[:faces] += 1
          entity.vertices.each { |vertex| stats[:points] << vertex.position.transform(relative) }
        elsif entity.is_a?(Sketchup::Edge)
          stats[:edge] += entity.length(world)
          stats[:edges] += 1
          [entity.start, entity.end].each { |vertex| stats[:points] << vertex.position.transform(relative) }
        end
      end
    end
  end
end
