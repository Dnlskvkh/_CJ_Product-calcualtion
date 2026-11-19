# encoding: UTF-8
# Run in SketchUp's Ruby runtime. Pure test doubles + native Geom math: no model edits.
require_relative 'cj_calculator/geometry'
module CJGeometryCheck
  Vertex = Struct.new(:position)
  Layer = Struct.new(:visible?, :folder, :name)
  Definition = Struct.new(:entities, :name, :manifold?)
  class Entity
    attr_accessor :hidden
    attr_writer :test_layer
    attr_reader :persistent_id
    def initialize(id, type)
      @persistent_id, @type, @hidden = id, type, false
    end
    def is_a?(type)
      type == @type || super
    end
    def visible?; !@hidden; end
    def layer; @test_layer || Layer.new(true, nil); end
    def material; nil; end
    def typename; @type.name.split('::').last; end
    def name; 'Тест'; end
  end
  class Edge < Entity
    attr_reader :start, :end
    def initialize(id, a, b)
      super(id, Sketchup::Edge)
      @start, @end = Vertex.new(a), Vertex.new(b)
    end
    def length(transform)
      @start.position.transform(transform).distance(@end.position.transform(transform))
    end
  end
  class Face < Entity
    attr_reader :vertices, :edges
    def initialize(id, points, edges = [])
      super(id, Sketchup::Face)
      @vertices, @edges = points.map { |p| Vertex.new(p) }, edges
    end
    def area(transform)
      p = @vertices.map { |v| v.position.transform(transform) }
      (p[1] - p[0]).cross(p[3] - p[0]).length
    end
  end
  class Group < Entity
    attr_reader :definition, :transformation
    def initialize(id, definition, transform, unscaled_volume = 6000.0)
      super(id, Sketchup::Group)
      @definition, @transformation, @unscaled_volume = definition, transform, unscaled_volume
    end
    def volume; @unscaled_volume * CJCalculator::Geometry.determinant(@transformation); end
    def manifold?; @definition.manifold?; end
  end
  class Selection < Array
    def to_a; self; end
    def sort_by(&block); Selection.new(super(&block)); end
    def grep(type); select { |entity| entity.is_a?(type) }; end
  end
  Model = Struct.new(:selection, :edit_transform, :active_path, :guid, :title, :path) do
    def selection; Selection.new(self[:selection]); end
  end
  def self.near(a, b)
    raise "Expected #{b}, received #{a}" unless a && (a - b).abs < [b.abs * 1e-9, 1e-10].max
  end
  def self.run
    identity = Geom::Transformation.new
    points = [[0,0,0],[10,0,0],[10,20,0],[0,20,0],[0,0,30],[10,0,30],[10,20,30],[0,20,30]].map { |p| Geom::Point3d.new(p) }
    pairs = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
    edges = pairs.each_with_index.map { |(a,b),i| Edge.new(100+i, points[a], points[b]) }
    loops = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[3,2,6,7],[0,3,7,4],[1,2,6,5]]
    faces = loops.each_with_index.map { |indices,i| Face.new(200+i, indices.map { |j| points[j] }, edges.select { |e| indices.map { |j| points[j] }.include?(e.start.position) && indices.map { |j| points[j] }.include?(e.end.position) }) }
    definition = Definition.new(faces+edges, 'Коробка', true)
    scale = Geom::Transformation.scaling(2,3,4)
    group = Group.new(1, definition, scale)
    rotation = Geom::Transformation.rotation(ORIGIN, Z_AXIS, 0.7)
    model = Model.new([group], rotation, nil, 'test-guid', 'Test')
    capture = ->(options = {}) { CJCalculator::Geometry.new(model, options).capture }
    row = capture.call['parts'][0]
    row['dimensions_m'].zip([20,60,120]).each { |a,b| near(a,b*0.0254) }
    near(row['surface_area_m2'], 2*(20*60+60*120+20*120)*0.0254**2)
    near(row['edge_length_m'], 4*(20+60+120)*0.0254)
    near(row['volume_m3'], 20*60*120*0.0254**3)
    stable = capture.call
    raise 'Unstable snapshot' unless stable == capture.call
    model.edit_transform = rotation * Geom::Transformation.scaling(-1,2,1)
    near(capture.call['parts'][0]['volume_m3'], 20*60*120*2*0.0254**3)
    model.edit_transform = identity
    child2 = Group.new(2, definition, Geom::Transformation.translation([100,0,0]))
    assembly = Group.new(3, Definition.new([group,child2], 'Узел', false), Geom::Transformation.scaling(2,2,2))
    assembly.test_layer = Layer.new(true, nil, 'Лиственница')
    model.selection = [assembly]
    flat = capture.call('split' => true)
    raise 'Parent material tag lost' unless flat['parts'].all? { |p| p['labels'].include?({ 'source' => 'parent_tag', 'text' => 'Лиственница' }) }
    raise 'Definition name lost' unless flat['parts'][0]['labels'].include?({ 'source' => 'definition', 'text' => 'Коробка' })
    raise 'Lost or duplicate instances' unless flat['parts'].length == 2 && flat['parts'].map { |p| p['occurrence'] }.uniq.length == 2
    near(flat['parts'][0]['volume_m3'], 20*60*120*8*0.0254**3)
    raise 'Assembly volume must be unknown' unless capture.call['parts'][0]['volume_m3'].nil?
    group.hidden = true
    raise 'Hidden instance counted' unless capture.call('split'=>true)['parts'].length == 1
    raise 'Explicit hidden inclusion failed' unless capture.call('split'=>true,'include_hidden'=>true)['parts'].length == 2
    group.hidden = false
    group.test_layer = Layer.new(true, Layer.new(false, nil))
    raise 'Hidden tag folder counted' unless capture.call('split'=>true)['parts'].length == 1
    group.test_layer = nil
    faces[0].hidden = true
    model.selection = [group]
    raise 'Filtered solid volume must be unknown' unless capture.call['parts'][0]['volume_m3'].nil?
    near(capture.call('include_hidden'=>true)['parts'][0]['volume_m3'], 20*60*120*0.0254**3)
    faces[0].hidden = false
    model.selection = [faces[0]] + faces[0].edges
    raise 'Face boundary counted twice' unless capture.call['parts'].length == 1
    model.selection = [edges[0]]
    model.edit_transform = scale
    near(capture.call['parts'][0]['edge_length_m'], 20*0.0254)
    model.path = 'C:/synthetic/model.skp'
    source_before_save = capture.call['model_id']
    model.guid = 'changed-by-save'
    raise 'Save changed source identity' unless source_before_save == capture.call['model_id']
    model.selection = []
    begin
      capture.call
      raise 'Empty selection accepted'
    rescue RuntimeError => e
      raise unless e.message.include?('Выделите')
    end
    { passed: true, cases: ['scaled box', 'rotation', 'mirrored parent', 'nested scale', 'shared definition occurrences', 'hidden objects and tag folders', 'unknown assembly volume', 'selected face edge deduplication', 'scaled edge', 'stable snapshot', 'source identity after save', 'empty selection'], model_edited: false }
  end
end
